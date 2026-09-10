mod pb;

use pb::gantry::v1::{Sandwich, Sandwiches, Swap, Swaps};
use std::collections::HashMap;
use std::str::FromStr;
use substreams::errors::Error;
use substreams::scalar::BigInt;
use substreams_ethereum::pb::eth::v2 as eth;

/// keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)")
const SWAP_TOPIC: [u8; 32] = [
    0x40, 0xe9, 0xce, 0xcb, 0x9f, 0x5f, 0x1f, 0x1c, 0x5b, 0x9c, 0x97, 0xde, 0xc2, 0x91, 0x7b, 0x7e,
    0xe9, 0x2e, 0x57, 0xba, 0x55, 0x63, 0x70, 0x8d, 0xac, 0xa9, 0x4d, 0xd8, 0x4a, 0xd7, 0x11, 0x2f,
];

/// How closely a backrun must reverse its own frontrun, as a percentage.
const OFFSET_TOLERANCE_PCT: u64 = 20;

substreams_ethereum::init!();

#[substreams::handlers::map]
fn map_swaps(block: eth::Block) -> Result<Swaps, Error> {
    let mut swaps = Vec::new();

    for log_view in block.logs() {
        let log = log_view.log;
        if log.topics.len() < 3 || log.topics[0].as_slice() != SWAP_TOPIC {
            continue;
        }
        if log.data.len() < 64 {
            continue;
        }

        // v4 emits the swapper's own balance delta, so a negative token0 amount
        // means they paid token0 in.
        let amount0 = BigInt::from_signed_bytes_be(&log.data[0..32]);
        let amount1 = BigInt::from_signed_bytes_be(&log.data[32..64]);
        let zero_for_one = amount0 < BigInt::zero();

        let (amount_in, amount_out) = if zero_for_one {
            (amount0.neg(), amount1.clone())
        } else {
            (amount1.neg(), amount0.clone())
        };

        swaps.push(Swap {
            block_number: block.number,
            log_index: log.block_index,
            pool_id: format!("0x{}", hex::encode(&log.topics[1])),
            sender: format!("0x{}", hex::encode(&log.topics[2][12..])),
            zero_for_one,
            amount_in: amount_in.to_string(),
            amount_out: amount_out.to_string(),
            tx_hash: format!("0x{}", hex::encode(log_view.receipt.transaction.hash.clone())),
        });
    }

    swaps.sort_by_key(|s| s.log_index);
    Ok(Swaps { swaps })
}

/// True when the two legs are within tolerance of each other.
fn offsets(front_out: &BigInt, back_in: &BigInt) -> bool {
    let zero = BigInt::zero();
    if front_out <= &zero || back_in <= &zero {
        return false;
    }
    let (lo, hi) = if front_out < back_in {
        (front_out, back_in)
    } else {
        (back_in, front_out)
    };
    (hi.clone() - lo.clone()) * BigInt::from(100u64) <= hi.clone() * BigInt::from(OFFSET_TOLERANCE_PCT)
}

#[substreams::handlers::map]
fn map_sandwiches(swaps: Swaps) -> Result<Sandwiches, Error> {
    let mut by_pool: HashMap<(u64, String), Vec<Swap>> = HashMap::new();
    for swap in swaps.swaps {
        by_pool
            .entry((swap.block_number, swap.pool_id.clone()))
            .or_default()
            .push(swap);
    }

    let mut found = Vec::new();

    for ((block_number, pool_id), mut group) in by_pool {
        group.sort_by_key(|s| s.log_index);

        let mut by_sender: HashMap<String, Vec<usize>> = HashMap::new();
        for (i, swap) in group.iter().enumerate() {
            by_sender
                .entry(swap.sender.to_lowercase())
                .or_default()
                .push(i);
        }

        for (sender, positions) in by_sender {
            if positions.len() < 2 {
                continue;
            }
            let mut used = vec![false; positions.len()];

            for a in 0..positions.len() {
                if used[a] {
                    continue;
                }
                let front = &group[positions[a]];

                for b in (a + 1)..positions.len() {
                    if used[b] {
                        continue;
                    }
                    let back = &group[positions[b]];
                    if back.zero_for_one == front.zero_for_one {
                        continue;
                    }

                    let front_out = BigInt::from_str(&front.amount_out).unwrap_or(BigInt::zero());
                    let back_in = BigInt::from_str(&back.amount_in).unwrap_or(BigInt::zero());
                    if !offsets(&front_out, &back_in) {
                        continue;
                    }

                    let victims: Vec<String> = group
                        .iter()
                        .filter(|s| {
                            s.log_index > front.log_index
                                && s.log_index < back.log_index
                                && s.sender.to_lowercase() != sender
                                && s.zero_for_one == front.zero_for_one
                        })
                        .map(|s| s.sender.clone())
                        .collect();

                    if victims.is_empty() {
                        continue;
                    }

                    found.push(Sandwich {
                        block_number,
                        pool_id: pool_id.clone(),
                        attacker: front.sender.clone(),
                        victims,
                        frontrun_index: front.log_index,
                        backrun_index: back.log_index,
                    });

                    used[a] = true;
                    used[b] = true;
                    break;
                }
            }
        }
    }

    found.sort_by_key(|s| (s.block_number, s.frontrun_index));
    Ok(Sandwiches { sandwiches: found })
}
