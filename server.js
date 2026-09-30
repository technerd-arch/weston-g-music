const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
// Configure multer for temporary memory storage of uploaded files
const upload = multer({ storage: multer.memoryStorage() });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- SONGS API ROUTES ---
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
app.post('/api/admin/upload', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, album, release_type } = req.body;
        const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
        const coverFile = req.files && req.files['cover'] ? req.files['cover'][0] : null;

        if (!audioFile) return res.status(400).json({ error: 'Audio file is required.' });

        // 1. Upload Audio to Supabase Storage Bucket
        const audioFileName = `audio_${Date.now()}_${audioFile.originalname}`;
        const { error: audioUploadErr } = await supabase.storage
            .from('music-assets')
            .upload(audioFileName, audioFile.buffer, { contentType: audioFile.mimetype });

        if (audioUploadErr) throw audioUploadErr;

        // Get public URL for the audio file
        const { data: audioPublicUrlData } = supabase.storage
            .from('music-assets')
            .getPublicUrl(audioFileName);

        // 2. Upload Cover Image (if provided)
        let coverUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
        if (coverFile) {
            const coverFileName = `cover_${Date.now()}_${coverFile.originalname}`;
            const { error: coverUploadErr } = await supabase.storage
                .from('music-assets')
                .upload(coverFileName, coverFile.buffer, { contentType: coverFile.mimetype });

            if (!coverUploadErr) {
                const { data: coverPublicUrlData } = supabase.storage
                    .from('music-assets')
                    .getPublicUrl(coverFileName);
                coverUrl = coverPublicUrlData.publicUrl;
            }
        }

        // 3. Save Song record to Database
        const { data, error: dbErr } = await supabase
            .from('songs')
            .insert([{
                title,
                artist: 'Weston G',
                album: album || 'Single',
                cover_image: coverUrl,
                audio_url: audioPublicUrlData.publicUrl,
                release_type: release_type || 'latest',
                stream_count: 0
            }])
            .select()
            .single();

        if (dbErr) throw dbErr;
        res.status(201).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CHAT API ROUTES ---
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

// --- PROFILES API ROUTES ---
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