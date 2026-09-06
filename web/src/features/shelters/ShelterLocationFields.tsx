import { useState } from 'react';
import { useResource } from '../../hooks/useResource';

type Shelter = { id: number; name: string; address: string; tel: string };
const normalize = (value: string) => value.trim().replace(/台/g, '臺');

export function ShelterLocationFields({
    city,
    shelterId,
}: {
    city: string;
    shelterId: string;
}) {
    const [draftCity, setCity] = useState(city);
    const [selected, setSelected] = useState(shelterId);
    const result = useResource<{
        extras: { shelters: Shelter[]; truncated: boolean };
    }>('/api/animals/shelters');
    const shelters = result.data?.extras.shelters ?? [];
    const available = shelters.filter((shelter) =>
        normalize(shelter.address).includes(normalize(draftCity)),
    );
    const cities = [
        ...new Set(
            shelters
                .map(
                    (shelter) =>
                        normalize(shelter.address).match(/^.*?[市縣]/)?.[0],
                )
                .filter(Boolean),
        ),
    ];
    const current = available.find(
        (shelter) => String(shelter.id) === selected,
    );
    return (
        <>
            <label>
                縣市／地址
                <input
                    name="city"
                    value={draftCity}
                    onChange={(event) => {
                        setCity(event.target.value);
                        setSelected('');
                    }}
                    placeholder="例如：臺北市"
                    maxLength={100}
                    list="shelter-cities"
                />
                <datalist id="shelter-cities">
                    {cities.map((value) => (
                        <option key={value} value={value} />
                    ))}
                </datalist>
            </label>
            <div className="shelter-picker">
                <label htmlFor="shelter-select">收容所</label>
                    <select
                        id="shelter-select"
                        name="shelterId"
                        value={selected}
                        onChange={(event) => setSelected(event.target.value)}
                        aria-describedby="shelter-help"
                    >
                        <option value="">全部收容所</option>
                        {selected && !current && (
                            <option value={selected}>
                                指定收容所（名稱暫無法取得）
                            </option>
                        )}
                        {available.map((shelter) => (
                            <option key={shelter.id} value={shelter.id}>
                                {shelter.name}
                            </option>
                        ))}
                    </select>
                <p id="shelter-help" className="muted">
                    {result.loading
                        ? '正在取得收容所清單…'
                        : result.error
                          ? '清單暫時無法取得，仍可使用其他篩選。'
                          : !available.length
                            ? '此地區沒有收容所選項，可修改地址再查詢。'
                            : current
                              ? current.address
                              : '先選地區，可縮小收容所清單。'}
                </p>
                {result.error && (
                    <button type="button" onClick={result.reload}>
                        重載收容所清單
                    </button>
                )}
                {result.data?.extras.truncated && (
                    <p className="muted">
                        清單僅顯示前 500 間；仍可用地址查詢其他地區。
                    </p>
                )}
                {selected && result.data && !current && (
                    <p className="muted">
                        此收容所不在目前地區清單內；查詢仍保留你的指定條件，不會自動改成全部。
                    </p>
                )}
            </div>
        </>
    );
}
