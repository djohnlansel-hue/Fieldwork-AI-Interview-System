const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "fieldwork-data.json");
app.use(express.json({limit:"10mb"}));
app.use(express.static(path.join(__dirname, "public")));
app.get("/healthz", (_req,res)=>res.status(200).json({ok:true}));
app.get("/api/state", async (_req,res)=>{
  try { const raw=await fs.readFile(DATA_FILE,"utf8"); res.json(JSON.parse(raw)); }
  catch(e){ if(e.code==="ENOENT") return res.json({version:2,data:{surveys:[],respondents:[],sessions:[],questions:[],responses:[],activity:[]}}); res.status(500).json({error:"Unable to read saved data"}); }
});
app.put("/api/state", async (req,res)=>{
  if(!req.body || req.body.version!==2 || !req.body.data || typeof req.body.data!=="object") return res.status(400).json({error:"Invalid state payload"});
  try { const tmp=DATA_FILE+".tmp"; await fs.writeFile(tmp,JSON.stringify(req.body,null,2),"utf8"); await fs.rename(tmp,DATA_FILE); res.json({ok:true,savedAt:new Date().toISOString()}); }
  catch { res.status(500).json({error:"Unable to persist data"}); }
});
app.get("*", (_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Fieldwork server listening on "+PORT));
