import express from 'express';

const router = express.Router();

router.get('/register', (req, res) => {
	res.render('register', { user: res.locals.user });
});

router.get('/login', (req, res) => {
	res.render('login', { user: res.locals.user });
});

router.get('/', (req, res) => {
	res.render('home', { user: res.locals.user });
});

router.get('/report-lost', (req, res) => {
	res.render('lost-pet-form', { user: res.locals.user });
});

router.get('/profile', (req, res) => {
	res.render('profile',
		{
			user: res.locals.user
		}
	);
});

router.get('/quick-use', (req, res) => {
	res.render('quick-use', { user: res.locals.user });
});

export { router };
