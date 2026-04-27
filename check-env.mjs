const key = process.env.GLM4_API_KEY;
console.log('GLM4_API_KEY exists:', !!key);
console.log('GLM4_API_KEY length:', key?.length ?? 0);
console.log('GLM4_API_KEY prefix:', key?.substring(0, 8) ?? 'MISSING');
