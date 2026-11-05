(() => {
  const enemySpeeds = {
    "b-b-bunny": 12,
    "kang-roo": 11,
    "squire-rel": 13,
    mooth: 10
  };

  for (const [enemy, speed] of Object.entries(enemySpeeds)) {
    const stats = BATTLE_UNIT_STATS[enemy];
    if (stats) {
      stats.speed = speed;
    } else {
      console.warn("Enemy speed override could not find:", enemy);
    }
  }
})();
