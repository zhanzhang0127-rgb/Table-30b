import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(url);
  
  // Check if postLikes table exists
  const [tables] = await conn.query("SHOW TABLES LIKE 'postLikes'");
  if (tables.length === 0) {
    console.log('Creating postLikes table...');
    await conn.query(`
      CREATE TABLE postLikes (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        postId int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT postLikes_id PRIMARY KEY(id),
        CONSTRAINT postLikes_userId_postId_unique UNIQUE(userId, postId)
      )
    `);
    console.log('postLikes table created.');
  } else {
    console.log('postLikes table already exists.');
  }

  // Check if commentLikes table exists
  const [tables2] = await conn.query("SHOW TABLES LIKE 'commentLikes'");
  if (tables2.length === 0) {
    console.log('Creating commentLikes table...');
    await conn.query(`
      CREATE TABLE commentLikes (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        commentId int NOT NULL,
        createdAt timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT commentLikes_id PRIMARY KEY(id),
        CONSTRAINT commentLikes_userId_commentId_unique UNIQUE(userId, commentId)
      )
    `);
    console.log('commentLikes table created.');
  } else {
    console.log('commentLikes table already exists.');
  }

  await conn.end();
  console.log('Migration complete.');
}

run().catch(e => { console.error(e); process.exit(1); });
