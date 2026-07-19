import pgPromise from 'pg-promise';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const pgp = pgPromise();

const db = pgp({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

// Test connection
db.connect()
  .then((connection) => {
    logger.info('Database connected successfully');
    connection.done();
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

export default db;
