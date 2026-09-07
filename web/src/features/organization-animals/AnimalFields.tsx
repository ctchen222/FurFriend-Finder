import type { AnimalListingFields } from '../../../../src/contracts/organizationAnimals';
import { listingLabels } from '../../../../src/contracts/organizationAnimals';

export function AnimalFields({
    fields,
    onChange,
    disabled,
}: {
    fields: AnimalListingFields;
    onChange: (fields: AnimalListingFields) => void;
    disabled: boolean;
}) {
    return (
        <fieldset className="listing-fields" disabled={disabled}>
            <legend>基本資料</legend>
            <label>
                <span>
                    名字 <span className="muted">必填</span>
                </span>
                <input
                    name="name"
                    required
                    maxLength={80}
                    value={fields.name}
                    autoComplete="off"
                    placeholder="例如：小橘"
                    onChange={(e) =>
                        onChange({ ...fields, name: e.target.value })
                    }
                />
            </label>
            <label>
                動物種類
                <select
                    value={fields.species}
                    onChange={(e) =>
                        onChange({
                            ...fields,
                            species: e.target
                                .value as AnimalListingFields['species'],
                        })
                    }
                >
                    {Object.entries(listingLabels.species).map(
                        ([key, value]) => (
                            <option key={key} value={key}>
                                {value}
                            </option>
                        ),
                    )}
                </select>
            </label>
            <div className="listing-traits">
                {(['sex', 'ageGroup', 'size', 'adoptionStatus'] as const).map(
                    (key) => (
                        <label key={key}>
                            {
                                {
                                    sex: '性別',
                                    ageGroup: '年齡階段',
                                    size: '體型',
                                    adoptionStatus: '送養狀態',
                                }[key]
                            }
                            <select
                                value={fields[key]}
                                onChange={(e) =>
                                    onChange({
                                        ...fields,
                                        [key]: e.target.value,
                                    })
                                }
                            >
                                {Object.entries(listingLabels[key]).map(
                                    ([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>
                    ),
                )}
            </div>
            <label>
                <span>
                    所在縣市 <span className="muted">公開前必填</span>
                </span>
                <input
                    name="city"
                    maxLength={30}
                    value={fields.city}
                    placeholder="例如：臺北市"
                    onChange={(e) =>
                        onChange({ ...fields, city: e.target.value })
                    }
                />
            </label>
            <label>
                <span>
                    認識牠 <span className="muted">公開前必填</span>
                </span>
                <textarea
                    name="description"
                    rows={5}
                    maxLength={3000}
                    value={fields.description}
                    placeholder="介紹牠的個性、生活習慣及需要的照顧。請勿填寫私人電話或住址。"
                    onChange={(e) =>
                        onChange({ ...fields, description: e.target.value })
                    }
                />
            </label>
            <label>
                <span>
                    領養前請了解 <span className="muted">選填</span>
                </span>
                <textarea
                    name="adoptionRequirements"
                    rows={3}
                    maxLength={2000}
                    value={fields.adoptionRequirements}
                    placeholder="例如：需要定期回診、希望家中有防護網。"
                    onChange={(e) =>
                        onChange({
                            ...fields,
                            adoptionRequirements: e.target.value,
                        })
                    }
                />
            </label>
        </fieldset>
    );
}
