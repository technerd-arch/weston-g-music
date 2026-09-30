const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for temporary memory storage of uploaded files
const upload = multer({ storage: multer.memoryStorage() });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- SONGS ---
app.get('/api/songs', async (req, res) => {
    try {
        const { data, error } = await supabase.from('songs').select('*').order('id', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/songs/:id/stream', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: song, error: fetchErr } = await supabase.from('songs').select('stream_count').eq('id', id).single();
        if (fetchErr) return res.status(404).json({ error: 'Song not found' });

        const newCount = (song.stream_count || 0) + 1;
        const { data, error: updateErr } = await supabase
            .from('songs')
            .update({ stream_count: newCount })
            .eq('id', id)
            .select()
            .single();

        if (updateErr) throw updateErr;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Upload Song with Real Files (Audio + Cover Image)
document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('adm-title').value);
    formData.append('album', document.getElementById('adm-album').value);
    formData.append('release_type', document.getElementById('adm-type').value);
    formData.append('audio', document.getElementById('adm-audio').files[0]);
    
    const coverFile = document.getElementById('adm-cover').files[0];
    if (coverFile) {
        formData.append('cover', coverFile);
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerText = 'Uploading to Cloud...';

    try {
        const res = await fetch(`${API_URL}/admin/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            alert('Song and audio file uploaded successfully!');
            loadSongs();
            document.getElementById('admin-form').reset();
        } else {
            alert(data.error || 'Upload failed');
        }
    } catch (err) {
        console.error(err);
        alert('An error occurred during upload.');
    } finally {
        submitBtn.innerText = 'Upload & Publish Track';
    }
});
// --- CHAT & PROFILES ---
app.get('/api/chat', async (req, res) => {
    try {
        const { data, error } = await supabase.from('chat_messages').select('*').order('id', { ascending: false }).limit(20);
        if (error) throw error;
        res.json(data.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { username, message } = req.body;
        const { data, error } = await supabase.from('chat_messages').insert([{ username, message }]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profiles', async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/profiles', async (req, res) => {
    try {
        const { username, bio, instagram, tiktok } = req.body;
        const { data, error } = await supabase.from('profiles').upsert([{ username, bio, instagram, tiktok }], { onConflict: 'username' }).select().single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🎵 Weston G Upload Server running on port ${PORT}`));