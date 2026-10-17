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
    'pear', 'strawberry', 'corn', 'potato', 'tomato', 'lollipop', 'cupcake', 'bowl', 'spoon', 'fork',
    'plate', 'bottle', 'rabbit', 'sheep', 'chicken', 'monkey', 'shark', 'crab', 'worm', 'fox',
    'pumpkin', 'glove', 'scarf', 'boot', 'bucket', 'comb', 'light bulb', 'envelope', 'flag', 'pillow',
    'truck', 'wheel', 'ant', 'ladybug', 'mouth', 'leg', 'lightning', 'onion', 'pie', 'candy',
    'fence', 'broom', 'axe', 'feather', 'shell', 'nest', 'jar', 'zebra', 'tiger', 'bathtub',
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
    'peacock', 'koala', 'panda', 'gorilla', 'camel', 'seahorse', 'starfish', 'lobster', 'parrot', 'dolphin',
    'beaver', 'raccoon', 'scorpion', 'caterpillar', 'ostrich', 'rhino', 'hippo', 'superhero', 'princess', 'knight',
    'clown', 'cowboy', 'alien', 'witch', 'fairy', 'chef', 'king', 'windmill', 'barn', 'playground',
    'treehouse', 'magnifying glass', 'wheelbarrow', 'binoculars', 'trumpet', 'violin', 'piano', 'harp', 'burrito', 'sushi',
    'pretzel', 'waffle', 'roller skates', 'sledding', 'dancing', 'motorcycle', 'bulldozer', 'scooter', 'swing', 'mailbox',
  ],
  hard: [
    'gravity', 'echo', 'time travel', 'daydream', 'nightmare', 'jealous', 'invisible', 'electricity', 'vacation', 'traffic jam',
    'homework', 'deadline', 'wifi', 'password', 'selfie', 'karaoke', 'magic trick', 'fortune teller', 'haunted house', 'roller coaster',
    'black hole', 'solar eclipse', 'earthquake', 'avalanche', 'quicksand', 'mirage', 'jet lag', 'brain freeze', 'sleepwalking', 'hiccups',
    'evolution', 'recycling', 'photosynthesis', 'democracy', 'internet', 'pyramid', 'stonehenge', 'mummy', 'gladiator', 'samurai',
    'chameleon', 'platypus', 'narwhal', 'hedgehog', 'flamingo', 'scarecrow', 'werewolf', 'centaur', 'phoenix', 'yeti',
    'escalator', 'vending machine', 'treadmill', 'lawn mower', 'wind turbine', 'satellite', 'barbecue', 'chandelier', 'hammock', 'trampoline',
    'tug of war', 'sunburn', 'shipwreck', 'snowball fight', 'pillow fight', 'tightrope', 'bungee jumping', 'sandstorm', 'blizzard', 'tsunami',
    'heatwave', 'hide and seek', 'musical chairs', 'sleepover', 'thunderstorm', 'spring cleaning', 'garage sale', 'jigsaw puzzle', 'domino effect', 'constellation',
    'hibernation', 'migration', 'metamorphosis', 'camouflage', 'hypnosis', 'ventriloquist', 'marionette', 'scuba diving', 'hang gliding', 'rock climbing',
    'cartwheel', 'somersault', 'sunrise', 'brainstorm', 'surprise party', 'family tree', 'zip line', 'carousel', 'snow globe', 'scavenger hunt',
  ],
};

export const STARS = { easy: 0, medium: 1, hard: 2 }; // bonus stars for a guessed word, on top of the speed stars
