import * as migration_20261121_215530_initial from './20261121_215530_initial';
import * as migration_20261122_015720_attachments from './20261122_015720_attachments';

export const migrations = [
  {
    up: migration_20261121_215530_initial.up,
    down: migration_20261121_215530_initial.down,
    name: '20261121_215530_initial',
  },
  {
    up: migration_20261122_015720_attachments.up,
    down: migration_20261122_015720_attachments.down,
    name: '20261122_015720_attachments'
  },
];
