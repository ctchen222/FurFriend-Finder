import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalLost, MatchInput, QuickMatchRequest } from "../libs/zod/animals";
import MailService from "./mail";
import MatchingService from "./matching";
import * as apiMessage from '../libs/message';
import CustomError from "../libs/customError";
import logger from "../config/logger";
import OwnerRepository from "../repository/owner.db";
import { Owner } from "../libs/zod/owner";
import { recordMatchFlow } from "../config/metrics";

class AnimalLostService {
	private mailService: MailService;
	private repository: AnimalLostRepository;
	private ownerRepository: OwnerRepository;
	private matchingService: MatchingService;

	constructor(deps?: {
		mailService?: MailService;
		repository?: AnimalLostRepository;
		ownerRepository?: OwnerRepository;
		matchingService?: MatchingService;
	}) {
		this.mailService = deps?.mailService ?? new MailService();
		this.repository = deps?.repository ?? new AnimalLostRepository();
		this.ownerRepository = deps?.ownerRepository ?? new OwnerRepository();
		this.matchingService = deps?.matchingService ?? new MatchingService();
	}

	findMatchesAndSendMail = async (animalId: string) => {
		return recordMatchFlow(async () => {
			const lostAnimal = await this.repository.findById<AnimalLost>(animalId);
			if (!lostAnimal) {
				throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
			}

			const owner = await this.ownerRepository.findById<Owner>(lostAnimal.owner_id);
			if (!owner) {
				throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
			}

			const matchInput: MatchInput = {
				name: lostAnimal.name,
				colour: lostAnimal.colour,
				sex: lostAnimal.sex,
				kind: lostAnimal.kind,
				variety: lostAnimal.variety,
				lost_place: lostAnimal.lost_place,
			};

			const { metadata, top10Matches, allCandidates } = await this.matchingService.performMatch(matchInput);

			if (top10Matches.length > 0 && owner.email) {
				await this.mailService.sendMatchedMail(owner.email, owner.name, top10Matches);
				logger.info(`Sent matched mail to ${owner.email} for lost animal ID ${animalId}.`);
			}

			logger.info(`Found ${allCandidates.length} potential matches for lost animal ID ${animalId}. Returning top ${top10Matches.length} closest matches.`);
			return { metadata, lostAnimal, top10Matches };
		});
	}

	findMatches = async (lostAnimal: QuickMatchRequest) => {
		const { metadata, top10Matches } = await this.matchingService.performMatch(lostAnimal);
		return { metadata, matchedAnimals: top10Matches };
	}
}

export default AnimalLostService;
