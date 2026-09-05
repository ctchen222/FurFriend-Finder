export const KIND_ALIASES: Record<string, 'dog' | 'cat' | 'other'> = {
    '狗': 'dog', '犬': 'dog', 'dog': 'dog',
    '貓': 'cat', '猫': 'cat', 'cat': 'cat',
    '其他': 'other', 'other': 'other',
};

export const SEX_ALIASES: Record<string, 'male' | 'female'> = {
    '公': 'male', '雄': 'male', 'm': 'male', 'male': 'male',
    '母': 'female', '雌': 'female', 'f': 'female', 'female': 'female',
};

export const COLOUR_ALIASES: Record<string, string> = {
    '黑': 'black', '黑色': 'black', 'black': 'black',
    '白': 'white', '白色': 'white', 'white': 'white',
    '棕': 'brown', '棕色': 'brown', '咖啡': 'brown', '咖啡色': 'brown', 'brown': 'brown',
    '橘': 'orange', '橘色': 'orange', 'orange': 'orange',
    '虎斑': 'tabby', 'tabby': 'tabby',
};

export const VARIETY_ALIASES: Record<string, string> = {
    '米克斯': 'mixed', '混種': 'mixed', '混種犬': 'mixed-dog', '混種貓': 'mixed-cat',
};
