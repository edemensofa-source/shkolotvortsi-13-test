'use strict';
const fs=require('fs'),path=require('path');
const filename=process.env.DATA_FILE||path.join(__dirname,'rooms-v13.json');
let pool=null,queue=Promise.resolve();
async function init(){
 if(process.env.DATABASE_URL){
  const {Pool}=require('pg');
  pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:false},max:5});
  await pool.query('CREATE TABLE IF NOT EXISTS game_rooms (code TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const result=await pool.query('SELECT code,payload FROM game_rooms');
  return Object.fromEntries(result.rows.map(r=>[r.code,r.payload]));
 }
 try{return JSON.parse(fs.readFileSync(filename,'utf8'))}catch{return {}}
}
function save(rooms){
 const snapshot=JSON.parse(JSON.stringify(rooms));
 queue=queue.catch(e=>console.error('Попереднє збереження:',e)).then(async()=>{
  if(pool){
   const client=await pool.connect();
   try{await client.query('BEGIN');for(const [code,payload] of Object.entries(snapshot))await client.query('INSERT INTO game_rooms(code,payload) VALUES($1,$2::jsonb) ON CONFLICT(code) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()',[code,JSON.stringify(payload)]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }else{fs.mkdirSync(path.dirname(filename),{recursive:true});const tmp=filename+'.tmp';fs.writeFileSync(tmp,JSON.stringify(snapshot));fs.renameSync(tmp,filename)}
 });
 return queue;
}
module.exports={init,save};
