const prettifyAnimalData = (data: object[]) => {
  const numOfData = data.length;
  let textMsg = '';
  data.forEach((animal: any, idx: number) => {
    animal.variety = animal.variety.replace(/\s/g, '');
    textMsg += `${idx + 1}, ${animal.variety} | ${animal.sheltername} | ${animal.photo}\n `;
  });

  return textMsg;
};

export default prettifyAnimalData;
