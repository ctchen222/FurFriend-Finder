import request from 'supertest';
import express from 'express';
import { pool } from '../../db';
import { router as animalRouter } from '../../router/animalRouter';
import { addUserToLocals } from '../../middleware/userSession';
import { auth } from '../../auth';

// Mock external dependencies
jest.mock('../../auth');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(addUserToLocals);
app.use('/api/animals', animalRouter);

describe('AnimalController - fetchList Integration Tests', () => {
    beforeAll(async () => {
        // Ensure your test environment variables are set up for a test DB
        // For example, process.env.DATABASE_URL_TEST
        // await pool.connect();
    });

    beforeEach(async () => {
        // Clear tables before each test
        await pool.query('TRUNCATE TABLE animal RESTART IDENTITY CASCADE;');
    });

    afterEach(async () => {
        // Clean up after each test if necessary
    });

    afterAll(async () => {
        // Disconnect from test database
        // await pool.end();
    });

    // Helper function to insert animals
    const insertAnimal = async (name: string, kind: string, variety: string, sex: string, colour: string, lost_time: string, lost_place: string, picture: string, animal_shelter_id: number) => {
        const query = `
            INSERT INTO animal(name, kind, variety, sex, colour, lost_time, lost_place, picture, animal_shelter_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
        `;
        const values = [name, kind, variety, sex, colour, lost_time, lost_place, picture, animal_shelter_id];
        const { rows } = await pool.query(query, values);
        return rows[0].id;
    };

    // Helper to create a dummy animal shelter if needed
    const createAnimalShelter = async (name: string) => {
        const query = `INSERT INTO animal_shelter(name) VALUES ($1) RETURNING id;`;
        const { rows } = await pool.query(query, [name]);
        return rows[0].id;
    };

    describe('GET /api/animals', () => {
        it('should return an empty array if no animals exist', async () => {
            const response = await request(app).get('/api/animals');

            expect(response.statusCode).toBe(200);
            expect(response.body.animals).toEqual([]);
            expect(response.body.cursors.prevCursor).toBeUndefined();
            expect(response.body.cursors.nextCursor).toBeUndefined();
        });

        it('should return the first page of animals without a cursor', async () => {
            const shelterId = await createAnimalShelter('Test Shelter');
            const animalIds = [];
            for (let i = 1; i <= 5; i++) {
                animalIds.push(await insertAnimal(`Animal ${i}`, 'Dog', 'Mixed', 'M', 'Brown', '2023-01-01', 'City Park', 'url', shelterId));
            }

            const response = await request(app).get('/api/animals');

            expect(response.statusCode).toBe(200);
            expect(response.body.animals.length).toBe(5);
            expect(response.body.animals[0].name).toBe('Animal 1');
            expect(response.body.cursors.prevCursor).toBeUndefined();
            expect(response.body.cursors.nextCursor).toBeDefined();
        });

        it('should return the next page of animals with a forward cursor', async () => {
            const shelterId = await createAnimalShelter('Test Shelter');
            const animalIds = [];
            for (let i = 1; i <= 15; i++) {
                animalIds.push(await insertAnimal(`Animal ${i}`, 'Dog', 'Mixed', 'M', 'Brown', '2023-01-01', 'City Park', 'url', shelterId));
            }

            // Get first page and next cursor
            const firstPageResponse = await request(app).get('/api/animals?pageSize=10');
            const nextCursor = firstPageResponse.body.cursors.nextCursor;

            // Request second page
            const secondPageResponse = await request(app).get(`/api/animals?cursor=${nextCursor}&pageSize=10`);

            expect(secondPageResponse.statusCode).toBe(200);
            expect(secondPageResponse.body.animals.length).toBe(5);
            expect(secondPageResponse.body.animals[0].name).toBe('Animal 11');
            expect(secondPageResponse.body.cursors.prevCursor).toBeDefined();
            expect(secondPageResponse.body.cursors.nextCursor).toBeDefined(); // Should be defined if there are more animals
        });

        it('should return the previous page of animals with a backward cursor', async () => {
            const shelterId = await createAnimalShelter('Test Shelter');
            const animalIds = [];
            for (let i = 1; i <= 15; i++) {
                animalIds.push(await insertAnimal(`Animal ${i}`, 'Dog', 'Mixed', 'M', 'Brown', '2023-01-01', 'City Park', 'url', shelterId));
            }

            // Get first page and next cursor
            const firstPageResponse = await request(app).get('/api/animals?pageSize=10');
            const nextCursor = firstPageResponse.body.cursors.nextCursor;

            // Request second page
            const secondPageResponse = await request(app).get(`/api/animals?cursor=${nextCursor}&pageSize=10`);
            const prevCursorFromSecondPage = secondPageResponse.body.cursors.prevCursor;

            // Request first page again using prevCursor
            const prevPageResponse = await request(app).get(`/api/animals?cursor=${prevCursorFromSecondPage}&pageSize=10&direction=prev`);

            expect(prevPageResponse.statusCode).toBe(200);
            expect(prevPageResponse.body.animals.length).toBe(10);
            expect(prevPageResponse.body.animals[0].name).toBe('Animal 1');
            expect(prevPageResponse.body.cursors.prevCursor).toBeUndefined();
            expect(prevPageResponse.body.cursors.nextCursor).toBeDefined();
        });

        it('should return all animals if pageSize is larger than available animals', async () => {
            const shelterId = await createAnimalShelter('Test Shelter');
            for (let i = 1; i <= 3; i++) {
                await insertAnimal(`Animal ${i}`, 'Dog', 'Mixed', 'M', 'Brown', '2023-01-01', 'City Park', 'url', shelterId);
            }

            const response = await request(app).get('/api/animals?pageSize=10');

            expect(response.statusCode).toBe(200);
            expect(response.body.animals.length).toBe(3);
            expect(response.body.cursors.prevCursor).toBeUndefined();
            expect(response.body.cursors.nextCursor).toBeUndefined();
        });
    });
});
