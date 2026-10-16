// Words for Sketch & Guess. Each round the drawer picks one easy, one medium
// or one hard word; harder words earn a bonus star when guessed.

export const WORDS = {
  easy: [
    'apple', 'banana', 'cat', 'dog', 'fish', 'sun', 'moon', 'star', 'tree', 'house',
    'car', 'boat', 'ball', 'book', 'chair', 'cup', 'hat', 'shoe', 'sock', 'key',
    'door', 'bed', 'clock', 'eye', 'hand', 'foot', 'nose', 'ear', 'egg', 'cake',
    'pizza', 'bread', 'cheese', 'carrot', 'flower', 'leaf', 'cloud', 'rain', 'snow', 'fire',
    'bird', 'duck', 'cow', 'pig', 'frog', 'snake', 'mouse', 'bee', 'spider', 'snail',
    'kite', 'bell', 'drum', 'guitar', 'phone', 'lamp', 'table', 'window', 'ladder', 'bridge',
    'train', 'bus', 'plane', 'rocket', 'robot', 'ghost', 'crown', 'ring', 'heart', 'smile',
    'bone', 'umbrella', 'candle', 'balloon', 'gift', 'pencil', 'scissors', 'glasses', 'button', 'shirt',
    'pants', 'dress', 'tooth', 'mountain', 'island', 'beach', 'wave', 'sandwich', 'cookie', 'donut',
    'lemon', 'cherry', 'grapes', 'mushroom', 'turtle', 'whale', 'owl', 'horse', 'lion', 'bear',
  ],
  medium: [
    'giraffe', 'elephant', 'penguin', 'octopus', 'dinosaur', 'butterfly', 'kangaroo', 'crocodile', 'jellyfish', 'squirrel',
    'unicorn', 'dragon', 'mermaid', 'pirate', 'wizard', 'ninja', 'astronaut', 'vampire', 'skeleton', 'zombie',
    'castle', 'volcano', 'lighthouse', 'waterfall', 'rainbow', 'tornado', 'cactus', 'palm tree', 'igloo', 'tent',
    'campfire', 'snowman', 'sandcastle', 'treasure', 'map', 'compass', 'anchor', 'sword', 'shield', 'bow and arrow',
    'helicopter', 'submarine', 'bicycle', 'skateboard', 'tractor', 'ambulance', 'fire truck', 'hot air balloon', 'parachute', 'canoe',
    'hamburger', 'hot dog', 'popcorn', 'ice cream', 'spaghetti', 'pineapple', 'watermelon', 'avocado', 'pancakes', 'taco',
    'toothbrush', 'hairbrush', 'microphone', 'headphones', 'television', 'computer', 'camera', 'telescope', 'magnet', 'battery',
    'backpack', 'suitcase', 'wallet', 'trophy', 'medal', 'crayon', 'paintbrush', 'hammer', 'saw', 'shovel',
    'basketball', 'football', 'tennis', 'bowling', 'surfing', 'skiing', 'swimming', 'fishing', 'juggling', 'yoga',
    'birthday', 'wedding', 'picnic', 'haircut', 'sneeze', 'snore', 'shadow', 'spiderweb', 'footprint', 'fireworks',
  ],
  hard: [
    'gravity', 'echo', 'time travel', 'daydream', 'nightmare', 'jealous', 'invisible', 'electricity', 'vacation', 'traffic jam',
    'homework', 'deadline', 'wifi', 'password', 'selfie', 'karaoke', 'magic trick', 'fortune teller', 'haunted house', 'roller coaster',
    'black hole', 'solar eclipse', 'earthquake', 'avalanche', 'quicksand', 'mirage', 'jet lag', 'brain freeze', 'sleepwalking', 'hiccups',
    'evolution', 'recycling', 'photosynthesis', 'democracy', 'internet', 'pyramid', 'stonehenge', 'mummy', 'gladiator', 'samurai',
    'chameleon', 'platypus', 'narwhal', 'hedgehog', 'flamingo', 'scarecrow', 'werewolf', 'centaur', 'phoenix', 'yeti',
    'escalator', 'vending machine', 'treadmill', 'lawn mower', 'wind turbine', 'satellite', 'barbecue', 'chandelier', 'hammock', 'trampoline',
  ],
};

export const STARS = { easy: 0, medium: 1, hard: 2 }; // bonus stars for a guessed word, on top of the speed stars
