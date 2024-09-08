const prettifyAnimalData = (data: object[]) => {
  let textMsg = '';
  const numOfData = data.length;

  if (numOfData === 0) {
    textMsg += '[每日更新]:\n今日您所在的地區沒有新增動物';
  }

  data.forEach((animal: any, idx: number) => {
    animal.variety = animal.variety.replace(/\s/g, '');
    textMsg += `${idx + 1}, ${animal.variety} | ${animal.sheltername} | ${animal.photo}\n `;
  });

  return textMsg;
};

export default prettifyAnimalData;
