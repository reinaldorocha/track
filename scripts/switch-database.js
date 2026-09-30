const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'detect'; // 'postgres', 'sqlite', or 'detect'
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

let newProvider = 'postgresql';

if (target === 'postgres' || target === 'postgresql') {
  newProvider = 'postgresql';
} else if (target === 'sqlite') {
  newProvider = 'sqlite';
} else {
  // Detect from DATABASE_URL or environment
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:') || target === 'dev') {
    newProvider = 'sqlite';
  } else {
    newProvider = 'postgresql';
  }
}

const updatedContent = schemaContent.replace(
  /datasource db \{\s*provider\s*=\s*"[^"]*"/,
  `datasource db {\n  provider = "${newProvider}"`
);

fs.writeFileSync(schemaPath, updatedContent);
console.log(`[Prisma Database Provider] Schema configured for: ${newProvider}`);