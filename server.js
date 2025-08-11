const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit:'10mb'}));

const file = path.join(__dirname,'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB(){
  await db.read();
  db.data ||= { channels: [], videos: [] };
  // seed default channel if empty
  if(db.data.channels.length===0){
    db.data.channels.push({ id: 1, name: 'Madaa', image: '', description: '' });
    await db.write();
  }
}
initDB();

// GET init (channels + videos)
app.get('/api/init', async (req,res)=>{
  await db.read();
  res.json({ channels: db.data.channels, videos: db.data.videos });
});

// create channel
app.post('/api/channels', async (req,res)=>{
  const { name, image, description } = req.body;
  const ch = { id: nanoid(), name, image: image||'', description: description||'' };
  await db.read();
  db.data.channels.push(ch);
  await db.write();
  res.json({ channel: ch });
});

// create video metadata (called after uploading to Cloudinary)
app.post('/api/videos', async (req,res)=>{
  const { cloudinary_public_id, video_url, thumbnail, title, description, channelId, duration } = req.body;
  await db.read();
  const vid = {
    id: nanoid(),
    cloudinary_public_id: cloudinary_public_id || null,
    video_url,
    thumbnail: thumbnail || '',
    title: title || 'بدون عنوان',
    description: description || '',
    channelId: channelId || null,
    duration: duration || null,
    views: 0,
    likes: 0,
    dislikes: 0,
    comments: [],
    publishedAt: new Date().toISOString()
  };
  db.data.videos.unshift(vid);
  await db.write();
  res.json({ video: vid });
});

// get single video
app.get('/api/videos/:id', async (req,res)=>{
  await db.read();
  const v = db.data.videos.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:'not found'});
  res.json({ video: v });
});

// increment views
app.post('/api/videos/:id/view', async (req,res)=>{
  await db.read();
  const v = db.data.videos.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:'not found'});
  v.views = (v.views||0) + 1;
  await db.write();
  res.json({ ok:true, views: v.views });
});

// like / dislike
app.post('/api/videos/:id/like', async (req,res)=>{
  await db.read();
  const v = db.data.videos.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:'not found'});
  v.likes = (v.likes||0) + 1;
  await db.write();
  res.json({ ok:true, likes: v.likes });
});
app.post('/api/videos/:id/dislike', async (req,res)=>{
  await db.read();
  const v = db.data.videos.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:'not found'});
  v.dislikes = (v.dislikes||0) + 1;
  await db.write();
  res.json({ ok:true, dislikes: v.dislikes });
});

// add comment
app.post('/api/videos/:id/comment', async (req,res)=>{
  const { author, text } = req.body;
  if(!author || !text) return res.status(400).json({error:'missing'});
  await db.read();
  const v = db.data.videos.find(x=>x.id===req.params.id);
  if(!v) return res.status(404).json({error:'not found'});
  const c = { id: nanoid(), author, text, date: new Date().toISOString() };
  v.comments.push(c);
  await db.write();
  res.json({ ok:true, comment: c });
});

// simple search by title/description/channel
app.get('/api/search', async (req,res)=>{
  const q = (req.query.q||'').toLowerCase();
  await db.read();
  if(!q) return res.json({ videos: db.data.videos });
  const vids = db.data.videos.filter(v=> (v.title||'').toLowerCase().includes(q) || (v.description||'').toLowerCase().includes(q));
  res.json({ videos: vids });
});

// delete video (optional)
app.delete('/api/videos/:id', async (req,res)=>{
  await db.read();
  db.data.videos = db.data.videos.filter(v=>v.id!==req.params.id);
  await db.write();
  res.json({ ok:true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('Server running on', PORT));
