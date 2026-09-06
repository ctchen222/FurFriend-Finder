import 'dotenv/config';
import axios from 'axios';
import AnimalService from '../Service/animal';
import { pool } from '../db';

axios.defaults.timeout = 30_000;
new AnimalService().updateAnimalTable()
    .then(count => console.log(`Shelter animal rows processed: ${count}`))
    .catch(error => { console.error('Shelter import failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; })
    .finally(() => pool.end());
