import express from 'express';
import path from 'path';

const router = express.Router();

router.route('/').get((req, res) => {
    // res.send('TWOBAO');
    res.sendFile(path.join(__dirname, './public/index.html'));
});

export { router };
