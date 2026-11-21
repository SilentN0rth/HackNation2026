import * as migration_20261121_215530_initial from './20261121_215530_initial';

export const migrations = [
  {
    up: migration_20261121_215530_initial.up,
    down: migration_20261121_215530_initial.down,
    name: '20261121_215530_initial'
  },
];
