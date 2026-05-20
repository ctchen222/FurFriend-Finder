import express from 'express';
import OwnerRepository from '../repository/owner.db';
import AnimalLostRepository from '../repository/animalLost.db';

const ownerRepository = new OwnerRepository();
const animalLostRepository = new AnimalLostRepository();

const router = express.Router();

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
	if (!res.locals.user) {
		const returnTo = encodeURIComponent(req.originalUrl);
		return res.redirect(`/login?returnTo=${returnTo}`);
	}
	next();
};

router.get('/register', (req, res) => {
	res.render('register', { user: res.locals.user });
});

router.get('/login', (req, res) => {
	res.render('login', { user: res.locals.user });
});

router.get('/forgot-password', (req, res) => {
	res.render('forgot-password', { user: res.locals.user });
});

router.get('/reset-password', (req, res) => {
	res.render('reset-password', {
		user: res.locals.user,
		token: typeof req.query.token === 'string' ? req.query.token : '',
		error: typeof req.query.error === 'string' ? req.query.error : '',
	});
});

router.get('/', (req, res) => {
	res.render('home', { user: res.locals.user });
});

router.get('/report-lost', requireAuth, (req, res) => {
	const animalOwner = res.locals.user ? {
		name: res.locals.user.name,
		email: res.locals.user.email,
	} : {};
	res.render('lost-pet-form', {
		user: res.locals.user,
		animalOwner: animalOwner
	});
});

router.get('/profile', requireAuth, async (req, res) => {
	let lostAnimals: any[] = [];
	if (res.locals.user && res.locals.user.email) {
		const owner = await ownerRepository.findByEmail(res.locals.user.email);
		if (owner) {
			lostAnimals = await animalLostRepository.findByOwnerId(owner.id);
		}
	}

	res.render('profile', {
		user: res.locals.user,
		lostAnimals: lostAnimals
	});
});

router.get('/quick-use', (req, res) => {
	res.render('quick-use', { user: res.locals.user });
});

router.get('/shelter-animals', (req, res) => {
	res.render('shelter-animals', { user: res.locals.user });
});

export { router };
