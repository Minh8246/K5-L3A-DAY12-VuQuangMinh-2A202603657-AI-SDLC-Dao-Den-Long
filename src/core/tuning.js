// Nguồn sự thật duy nhất cho các con số gameplay.
// TUNING phải khớp game.contract.json (tests/contract.test.js kiểm tra).
// Giải thích từng giả định: docs/notes/phase-1.md

export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 5,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: Object.freeze({
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 50,
  }),
});

// Các hằng số thế giới không nằm trong contract (giả định A10, A12, A13, A15, A16).
export const WORLD = Object.freeze({
  tick_rate: 60,
  island_radius: 30,
  player_bound_radius: 29,
  lantern_ring_radius: 18,
  jump_speed: 7,
  gravity: 20,
  mote_count: 20,
  mote_spawn_radius: 26,
  mote_min_dist_player: 3,
  shade_initial: 2,
  shade_spawn_radius: 26,
  shade_spawn_interval_s: 25,
  shade_max: 5,
  shade_min_dist_player: 10,
  shade_y: 1,
  safe_margin: 0.01,
});
