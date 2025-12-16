import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pizza, Minus, Plus, Clock, AlertCircle, Users } from 'lucide-react';
import { api } from '../services/api';
import type { PizzaOption, VoteInput } from '../types';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';
import CountdownTimer from '../components/ui/CountdownTimer';
import Toast from '../components/ui/Toast';
import { useSocket } from '../context/SocketContext';
import { cn } from '../utils/cn';

interface SelectedPizza {
  pizzaOptionId: string;
  name: string;
  priority: 1 | 2 | 3;
}

// Funny quotes from TV shows and movies
const FUNNY_QUOTES = [
  // The Office - Michael Scott
  { quote: "That's what she said.", character: "Michael Scott" },
  { quote: "I'm not superstitious, but I am a little stitious.", character: "Michael Scott" },
  { quote: "Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me.", character: "Michael Scott" },
  { quote: "I knew exactly what to do. But in a much more real sense, I had no idea what to do.", character: "Michael Scott" },
  { quote: "Sometimes I'll start a sentence and I don't even know where it's going. I just hope I find it along the way.", character: "Michael Scott" },
  { quote: "I am Beyoncé, always.", character: "Michael Scott" },
  { quote: "I'm an early bird and I'm a night owl. So I'm wise and I have worms.", character: "Michael Scott" },
  { quote: "I declare bankruptcy!", character: "Michael Scott" },
  { quote: "Well, well, well, how the turntables...", character: "Michael Scott" },
  { quote: "I'm not offended by homosexuality. In the sixties, I made love to many, many women, often outdoors, in the mud and the rain... and it's possible a man slipped in. There would be no way of knowing.", character: "Creed Bratton" },
  { quote: "You miss 100% of the shots you don't take. – Wayne Gretzky", character: "Michael Scott" },
  { quote: "I feel like all my kids grew up, and then they married each other. It's every parent's dream.", character: "Michael Scott" },
  { quote: "And I knew exactly what to do. But in a much more real sense, I had no idea what to do.", character: "Michael Scott" },
  { quote: "I saved a life. My own. Am I a hero? I really can't say, but yes.", character: "Michael Scott" },
  { quote: "Wikipedia is the best thing ever. Anyone in the world can write anything they want about any subject. So you know you are getting the best possible information.", character: "Michael Scott" },
  { quote: "Bros before hos. Why? Because your bros are always there for you.", character: "Michael Scott" },
  { quote: "The worst thing about prison was the dementors.", character: "Michael Scott" },

  // The Office - Dwight Schrute
  { quote: "Identity theft is not a joke, Jim! Millions of families suffer every year!", character: "Dwight Schrute" },
  { quote: "Whenever I'm about to do something, I think, 'Would an idiot do that?' And if they would, I do not do that thing.", character: "Dwight Schrute" },
  { quote: "I am faster than 80% of all snakes.", character: "Dwight Schrute" },
  { quote: "In the wild, there is no health care. Health care is 'Oh, I broke my leg!' A lion comes and eats you, you're dead.", character: "Dwight Schrute" },
  { quote: "Before I do anything I ask myself 'Would an idiot do that?' And if the answer is yes, I do not do that thing.", character: "Dwight Schrute" },
  { quote: "Through concentration, I can raise and lower my cholesterol at will.", character: "Dwight Schrute" },
  { quote: "I don't have a lot of experience with vampires, but I have hunted werewolves. I shot one once, but by the time I got to it, it had turned back into my neighbor's dog.", character: "Dwight Schrute" },
  { quote: "How would I describe myself? Three words: hardworking, alpha male, jackhammer, merciless, insatiable.", character: "Dwight Schrute" },
  { quote: "I come from a long line of fighters. My maternal grandfather was the toughest guy I ever knew.", character: "Dwight Schrute" },

  // The Office - Other Characters
  { quote: "Bears. Beets. Battlestar Galactica.", character: "Jim Halpert" },
  { quote: "I wish there was a way to know you're in the good old days before you've actually left them.", character: "Andy Bernard" },
  { quote: "I'm not gonna cry over it. I already did that in the car on the way over.", character: "Andy Bernard" },
  { quote: "Sorry I annoyed you with my friendship.", character: "Andy Bernard" },
  { quote: "I'm always thinking one step ahead, like a carpenter that makes stairs.", character: "Andy Bernard" },
  { quote: "I ate a tuna sandwich on my first day, so Andy started calling me Big Tuna.", character: "Jim Halpert" },
  { quote: "I talk a lot, so I've learned to tune myself out.", character: "Kelly Kapoor" },
  { quote: "I'm not superstitious, but I am a little stitious.", character: "Michael Scott" },
  { quote: "I am running away from my responsibilities. And it feels good.", character: "Michael Scott" },
  { quote: "I don't care what they say about me. I just want to eat.", character: "Pam Beesly" },
  { quote: "I stopped caring a long time ago.", character: "Creed Bratton" },
  { quote: "Nobody steals from Creed Bratton and gets away with it. The last person to do this disappeared. His name? Creed Bratton.", character: "Creed Bratton" },
  { quote: "If I can't scuba, then what's this all been about?", character: "Creed Bratton" },
  { quote: "You're not real, man!", character: "Creed Bratton" },
  { quote: "I've been involved in a number of cults, both as a leader and a follower. You have more fun as a follower, but you make more money as a leader.", character: "Creed Bratton" },

  // Parks and Recreation - Ron Swanson
  { quote: "I know what I'm about, son.", character: "Ron Swanson" },
  { quote: "Never half-ass two things. Whole-ass one thing.", character: "Ron Swanson" },
  { quote: "Give me all the bacon and eggs you have.", character: "Ron Swanson" },
  { quote: "Clear alcohols are for rich women on diets.", character: "Ron Swanson" },
  { quote: "There's only one thing I hate more than lying: skim milk. Which is water that's lying about being milk.", character: "Ron Swanson" },
  { quote: "I'm a simple man. I like pretty, dark-haired women and breakfast food.", character: "Ron Swanson" },
  { quote: "Crying is acceptable at funerals and the Grand Canyon.", character: "Ron Swanson" },
  { quote: "Any dog under 50 pounds is a cat, and cats are useless.", character: "Ron Swanson" },
  { quote: "There is no wrong way to consume alcohol.", character: "Ron Swanson" },
  { quote: "Keep your tears in your eyes where they belong.", character: "Ron Swanson" },
  { quote: "Capitalism: God's way of determining who is smart and who is poor.", character: "Ron Swanson" },
  { quote: "When people get too chummy with me, I like to call them by the wrong name to let them know I don't really care about them.", character: "Ron Swanson" },
  { quote: "History began on July 4th, 1776. Everything before that was a mistake.", character: "Ron Swanson" },
  { quote: "I'd wish you the best of luck but I believe luck is a concept created by the weak to explain their failures.", character: "Ron Swanson" },
  { quote: "Just give me all the bacon and eggs you have. Wait, wait. I'm worried what you just heard was, 'Give me a lot of bacon and eggs.' What I said was, 'Give me all the bacon and eggs you have.' Do you understand?", character: "Ron Swanson" },
  { quote: "Fishing relaxes me. It's like yoga, except I still get to kill something.", character: "Ron Swanson" },

  // Parks and Recreation - Leslie Knope
  { quote: "Everything hurts and I'm dying.", character: "Leslie Knope" },
  { quote: "We need to remember what's important in life: friends, waffles, work. Or waffles, friends, work. Doesn't matter, but work is third.", character: "Leslie Knope" },
  { quote: "I am big enough to admit that I am often inspired by myself.", character: "Leslie Knope" },
  { quote: "What I hear when I'm being yelled at is people caring loudly at me.", character: "Leslie Knope" },
  { quote: "I have the most amazing idea. It came to me in a dream. And then I forgot it in another dream.", character: "Leslie Knope" },
  { quote: "If I had to have a stripper's name, it would be Equality.", character: "Leslie Knope" },
  { quote: "No one achieves anything alone.", character: "Leslie Knope" },
  { quote: "I'm a feminist, okay? I would never ever go to a strip club. I've gone on record that if I had to have a stripper name it would be Equality.", character: "Leslie Knope" },
  { quote: "Jogging is the worst! I know it keeps you healthy, but God, at what cost?", character: "Ann Perkins" },

  // Parks and Recreation - Other Characters
  { quote: "Treat yo'self!", character: "Tom Haverford & Donna Meagle" },
  { quote: "I have no idea what I'm doing, but I know I'm doing it really, really well.", character: "Andy Dwyer" },
  { quote: "I once forgot to brush my teeth for five weeks.", character: "Andy Dwyer" },
  { quote: "I typed your symptoms into the thing up here, and it says you could have network connectivity problems.", character: "Andy Dwyer" },
  { quote: "I'm allergic to sushi. Every time I eat more than 80 pieces, I throw up.", character: "Andy Dwyer" },
  { quote: "When life gives you lemons, you sell some of your grandma's jewelry and go clubbing.", character: "Jean-Ralphio Saperstein" },
  { quote: "I'm flushing with success!", character: "Jean-Ralphio Saperstein" },
  { quote: "Money please!", character: "Mona-Lisa Saperstein" },
  { quote: "The thing about youth culture is, I don't understand it.", character: "Jerry Gergich" },
  { quote: "Time is money, money is power, power is pizza, and pizza is knowledge.", character: "April Ludgate" },
  { quote: "I don't want to do things. I want to not do things.", character: "April Ludgate" },
  { quote: "I'm not interested in caring about people.", character: "April Ludgate" },
  { quote: "I wasn't listening, but I strongly disagree.", character: "April Ludgate" },
  { quote: "I hate talking to people about things.", character: "April Ludgate" },

  // Dumb & Dumber
  { quote: "So you're telling me there's a chance!", character: "Lloyd Christmas" },
  { quote: "We got no food, we got no jobs, our pets' heads are falling off!", character: "Lloyd Christmas" },
  { quote: "Just when I think you couldn't possibly be any dumber, you go and do something like this... and totally redeem yourself!", character: "Harry Dunne" },
  { quote: "That John Denver's full of it, man.", character: "Lloyd Christmas" },
  { quote: "I desperately want to make love to a schoolboy.", character: "Lloyd Christmas" },
  { quote: "Excuse me, Flo? What's the soup du jour? It's the soup of the day. Mmm, that sounds good. I'll have that.", character: "Lloyd Christmas" },
  { quote: "We don't usually pick up hitchhikers, but I'm gonna go with my instinct on this one. Saddle up, partner!", character: "Lloyd Christmas" },
  { quote: "According to the map, we've only gone four inches.", character: "Lloyd Christmas" },
  { quote: "Why you going to the airport? Flying somewhere?", character: "Lloyd Christmas" },
  { quote: "Big Gulps, huh? Alright! Welp, see ya later!", character: "Lloyd Christmas" },
  { quote: "I took care of it.", character: "Harry Dunne" },

  // Tommy Boy
  { quote: "I can get a good look at a T-bone by sticking my head up a bull's butt, but I'd rather take a butcher's word for it.", character: "Tommy Callahan" },
  { quote: "Fat guy in a little coat!", character: "Tommy Callahan" },
  { quote: "Did you eat a lot of paint chips when you were a kid?", character: "Richard Hayden" },
  { quote: "Brothers don't shake hands. Brothers gotta hug!", character: "Tommy Callahan" },
  { quote: "I can actually hear you getting fatter.", character: "Richard Hayden" },
  { quote: "That's gonna leave a mark.", character: "Tommy Callahan" },
  { quote: "Housekeeping! You want me fluff your pillow?", character: "Tommy Callahan" },
  { quote: "Richard, what's happening? Were you in an accident?", character: "Tommy Callahan" },
  { quote: "I know where you live and I've seen where you sleep. I swear to everything holy that your mothers will cry when they see what I've done to you.", character: "Richard Hayden" },
  { quote: "Does this suit make me look fat? No, your face does.", character: "Tommy & Richard" },
  { quote: "Lots of people go to college for seven years. Yeah, they're called doctors.", character: "Tommy & Richard" },
  { quote: "Hey, if you want me to take a dump in a box and mark it guaranteed, I will. I got spare time.", character: "Tommy Callahan" },

  // Anchorman
  { quote: "I'm kind of a big deal.", character: "Ron Burgundy" },
  { quote: "60% of the time, it works every time.", character: "Brian Fantana" },
  { quote: "I love lamp.", character: "Brick Tamland" },
  { quote: "Stay classy, San Diego.", character: "Ron Burgundy" },
  { quote: "I'm very important. I have many leather-bound books and my apartment smells of rich mahogany.", character: "Ron Burgundy" },
  { quote: "I'm in a glass case of emotion!", character: "Ron Burgundy" },
  { quote: "Milk was a bad choice!", character: "Ron Burgundy" },
  { quote: "I immediately regret this decision.", character: "Ron Burgundy" },
  { quote: "It's so damn hot. Milk was a bad choice.", character: "Ron Burgundy" },
  { quote: "I don't know how to put this, but I'm kind of a big deal. People know me.", character: "Ron Burgundy" },
  { quote: "You stay classy, Planet Earth.", character: "Ron Burgundy" },
  { quote: "Discovered by the Germans in 1904, they named it San Diego, which of course in German means a whale's vagina.", character: "Ron Burgundy" },
  { quote: "Boy, that escalated quickly.", character: "Ron Burgundy" },
  { quote: "I'm not a baby, I'm a man! An ANCHORMAN!", character: "Ron Burgundy" },
  { quote: "I ate a big red candle.", character: "Brick Tamland" },
  { quote: "Where'd you get those clothes... at the toilet store?", character: "Brick Tamland" },
  { quote: "LOUD NOISES!", character: "Brick Tamland" },

  // Step Brothers
  { quote: "Did we just become best friends? Yup!", character: "Brennan & Dale" },
  { quote: "This house is a prison! On planet bullcrap!", character: "Dale Doback" },
  { quote: "So much room for activities!", character: "Brennan & Dale" },
  { quote: "I'm not gonna call him Dad. Even if there's a fire!", character: "Brennan Huff" },
  { quote: "It's the Catalina Wine Mixer!", character: "Brennan Huff" },
  { quote: "I have a belly full of white dog crap in me, and now you lay this on me?", character: "Dale Doback" },
  { quote: "You have to call me Dragon.", character: "Dale Doback" },
  { quote: "I'm burying you.", character: "Dale Doback" },
  { quote: "Why are you so sweaty? I was watching Cops.", character: "Brennan & Dale" },
  { quote: "This is a house of learned doctors.", character: "Dale Doback" },
  { quote: "I smoked pot with Johnny Hopkins.", character: "Dale Doback" },
  { quote: "Boats 'N Hoes!", character: "Brennan & Dale" },
  { quote: "I tea-bagged your drum set!", character: "Brennan Huff" },
  { quote: "Hey, you're embarrassing yourself, you geriatric f***!", character: "Brennan Huff" },
  { quote: "Suppose Nancy sees me coming out of the shower and she decides to come on to me. I'm looking good, got a luscious V of hair going through my chest pubes down to my ball fro.", character: "Dale Doback" },

  // Talladega Nights
  { quote: "If you ain't first, you're last.", character: "Ricky Bobby" },
  { quote: "I wanna go fast!", character: "Ricky Bobby" },
  { quote: "Shake and bake!", character: "Ricky Bobby & Cal Naughton Jr." },
  { quote: "Help me Jesus! Help me Jewish God! Help me Allah! Help me Tom Cruise!", character: "Ricky Bobby" },
  { quote: "I'm just gonna lay here and bleed for a while.", character: "Ricky Bobby" },
  { quote: "I like to picture Jesus in a tuxedo T-shirt because it says I want to be formal, but I'm here to party.", character: "Cal Naughton Jr." },
  { quote: "That just happened!", character: "Ricky Bobby" },
  { quote: "You're not paralyzed! A cougar attack?!", character: "Ricky Bobby" },
  { quote: "Chip, I'm gonna come at you like a spider monkey!", character: "Texas Ranger" },

  // Elf
  { quote: "The best way to spread Christmas cheer is singing loud for all to hear.", character: "Buddy the Elf" },
  { quote: "I just like to smile. Smiling's my favorite.", character: "Buddy the Elf" },
  { quote: "You sit on a throne of lies!", character: "Buddy the Elf" },
  { quote: "I'm singing! I'm in a store and I'm singing!", character: "Buddy the Elf" },
  { quote: "You smell like beef and cheese.", character: "Buddy the Elf" },
  { quote: "I passed through the seven levels of the Candy Cane forest, through the sea of swirly twirly gum drops, and then I walked through the Lincoln Tunnel.", character: "Buddy the Elf" },
  { quote: "SON OF A NUTCRACKER!", character: "Buddy the Elf" },
  { quote: "Santa! Oh my God! I know him! I know him!", character: "Buddy the Elf" },
  { quote: "We elves try to stick to the four main food groups: candy, candy canes, candy corns, and syrup.", character: "Buddy the Elf" },
  { quote: "I'm a cotton-headed ninny muggins!", character: "Buddy the Elf" },
  { quote: "SANTA!!!", character: "Buddy the Elf" },
  { quote: "You have such a pretty face. You should be on a Christmas card!", character: "Buddy the Elf" },

  // Nacho Libre
  { quote: "Nachoooooo!", character: "Nacho" },
  { quote: "I ate some bugs. I ate some grass. I used my hand to wipe my tears.", character: "Nacho" },
  { quote: "Get that corn outta my face!", character: "Nacho" },
  { quote: "I am I am.", character: "Nacho" },
  { quote: "Beneath the clothes, we find a man. And beneath the man we find... his nucleus.", character: "Nacho" },
  { quote: "They don't think I know a buttload of crap about the gospel, but I do!", character: "Nacho" },
  { quote: "These are my recreation clothes.", character: "Nacho" },
  { quote: "Do you not realize I have had diarrhea since Easters?", character: "Esqueleto" },

  // Napoleon Dynamite
  { quote: "Gosh!", character: "Napoleon Dynamite" },
  { quote: "Vote for Pedro.", character: "Napoleon Dynamite" },
  { quote: "Tina, you fat lard, come get some dinner!", character: "Napoleon Dynamite" },
  { quote: "Your mom goes to college.", character: "Kip" },
  { quote: "I see you're drinking 1%. Is that 'cause you think you're fat? 'Cause you're not. You could be drinking whole if you wanted to.", character: "Napoleon Dynamite" },
  { quote: "I caught you a delicious bass.", character: "Napoleon Dynamite" },
  { quote: "This is pretty much the worst video ever made.", character: "Napoleon Dynamite" },
  { quote: "Do the chickens have large talons?", character: "Napoleon Dynamite" },
  { quote: "Lucky! Gosh!", character: "Napoleon Dynamite" },
  { quote: "Make yourself a dang quesadilla!", character: "Grandma" },
  { quote: "Girls only want boyfriends who have great skills.", character: "Napoleon Dynamite" },
  { quote: "I don't even have any good skills.", character: "Napoleon Dynamite" },

  // Zoolander
  { quote: "What is this? A center for ants?!", character: "Derek Zoolander" },
  { quote: "I'm pretty sure there's a lot more to life than being really, really, ridiculously good looking.", character: "Derek Zoolander" },
  { quote: "But why male models?", character: "Derek Zoolander" },
  { quote: "Moisture is the essence of wetness, and wetness is the essence of beauty.", character: "Derek Zoolander" },
  { quote: "I think I'm getting the Black Lung, Pop.", character: "Derek Zoolander" },
  { quote: "Blue Steel.", character: "Derek Zoolander" },
  { quote: "I'm not an ambi-turner.", character: "Derek Zoolander" },

  // The Hangover
  { quote: "What happens in Vegas, stays in Vegas. Except for herpes. That s*** will come back with you.", character: "Sid Garner" },
  { quote: "It's not a man purse. It's called a satchel. Indiana Jones wears one.", character: "Alan Garner" },
  { quote: "We're the three best friends that anyone could have!", character: "Alan Garner" },
  { quote: "Tigers love pepper. They hate cinnamon.", character: "Alan Garner" },
  { quote: "I'm not supposed to be within 200 feet of a school... or a Chuck E. Cheese.", character: "Alan Garner" },
  { quote: "You guys might not know this, but I consider myself a bit of a loner.", character: "Alan Garner" },
  { quote: "Remember what happens in Vegas stays in Vegas.", character: "Stu Price" },

  // Superbad
  { quote: "I am McLovin!", character: "Fogell" },
  { quote: "That's the coolest f***ing name I've ever heard.", character: "Seth" },
  { quote: "It's in! It's in!", character: "Fogell" },
  { quote: "People don't forget!", character: "Seth" },

  // Wedding Crashers
  { quote: "Ma! The meatloaf!", character: "Chazz Reinhold" },
  { quote: "I made you a painting. I call it 'Celebration.'", character: "Todd Cleary" },
  { quote: "Stage 5 clinger.", character: "Jeremy Grey" },
  { quote: "Crab cakes and football. That's what Maryland does!", character: "Chazz Reinhold" },

  // Bridesmaids
  { quote: "Help me, I'm poor.", character: "Annie Walker" },
  { quote: "I'm ready to paaaarty!", character: "Megan" },
  { quote: "It's coming out of me like lava!", character: "Megan" },
  { quote: "You're your problem, Annie. And you're also your solution.", character: "Megan" },

  // Mean Girls
  { quote: "She doesn't even go here!", character: "Damian" },
  { quote: "On Wednesdays we wear pink.", character: "Karen Smith" },
  { quote: "You can't sit with us!", character: "Gretchen Wieners" },
  { quote: "That's so fetch!", character: "Gretchen Wieners" },
  { quote: "Stop trying to make fetch happen!", character: "Regina George" },
  { quote: "I'm not like a regular mom, I'm a cool mom.", character: "Mrs. George" },
  { quote: "Boo, you whore!", character: "Regina George" },
  { quote: "The limit does not exist!", character: "Cady Heron" },
  { quote: "Four for you Glen Coco! You go Glen Coco!", character: "Damian" },
  { quote: "Get in loser, we're going shopping.", character: "Regina George" },

  // Caddyshack
  { quote: "So I got that goin' for me, which is nice.", character: "Carl Spackler" },
  { quote: "Cinderella story. Outta nowhere. A former greenskeeper, now, about to become the Masters champion.", character: "Carl Spackler" },
  { quote: "It's in the hole!", character: "Carl Spackler" },
  { quote: "Be the ball.", character: "Ty Webb" },

  // Ghostbusters
  { quote: "Who ya gonna call?", character: "Ghostbusters" },
  { quote: "I ain't afraid of no ghost!", character: "Ghostbusters" },
  { quote: "He slimed me.", character: "Peter Venkman" },
  { quote: "Dogs and cats, living together. Mass hysteria!", character: "Peter Venkman" },
  { quote: "Back off, man. I'm a scientist.", character: "Peter Venkman" },

  // Ace Ventura
  { quote: "Alrighty then!", character: "Ace Ventura" },
  { quote: "Do NOT go in there!", character: "Ace Ventura" },
  { quote: "Excuse me, I'd like to ass you a few questions.", character: "Ace Ventura" },
  { quote: "Like a glove!", character: "Ace Ventura" },
  { quote: "If I'm not back in five minutes, just wait longer.", character: "Ace Ventura" },
  { quote: "Laces out, Dan!", character: "Ray Finkle" },

  // The Princess Bride
  { quote: "As you wish.", character: "Westley" },
  { quote: "Hello. My name is Inigo Montoya. You killed my father. Prepare to die.", character: "Inigo Montoya" },
  { quote: "Inconceivable!", character: "Vizzini" },
  { quote: "You keep using that word. I do not think it means what you think it means.", character: "Inigo Montoya" },
  { quote: "Have fun storming the castle!", character: "Miracle Max" },

  // Monty Python and the Holy Grail
  { quote: "It's just a flesh wound!", character: "Black Knight" },
  { quote: "We are the knights who say 'Ni!'", character: "Knights of Ni" },
  { quote: "Run away! Run away!", character: "King Arthur" },
  { quote: "I fart in your general direction!", character: "French Guard" },
  { quote: "What... is the air-speed velocity of an unladen swallow?", character: "Bridge Keeper" },
  { quote: "Your mother was a hamster and your father smelt of elderberries!", character: "French Guard" },
  { quote: "We want... a shrubbery!", character: "Knights of Ni" },

  // Ferris Bueller's Day Off
  { quote: "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.", character: "Ferris Bueller" },
  { quote: "Bueller? Bueller? Bueller?", character: "Economics Teacher" },
  { quote: "I'm so disappointed in Cameron. Twenty bucks says he's in his car right now debating about whether or not to go out.", character: "Ferris Bueller" },
  { quote: "The question isn't what are we going to do. The question is what aren't we going to do.", character: "Ferris Bueller" },
];

export default function Vote() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { joinEvent, leaveEvent, onVoteUpdate, onVoteSubmitted, isConnected } = useSocket();

  const [selectedPizzas, setSelectedPizzas] = useState<SelectedPizza[]>([]);
  const [sliceCount, setSliceCount] = useState(3);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' } | null>(null);
  const [liveVoteCount, setLiveVoteCount] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [randomQuote, setRandomQuote] = useState<typeof FUNNY_QUOTES[0] | null>(null);

  // Fetch active event or specific event
  const { data: eventResponse, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => (eventId ? api.getEvent(eventId) : api.getActiveEvent()),
  });

  const event = eventResponse?.data;

  // Fetch my existing vote
  const { data: myVoteResponse } = useQuery({
    queryKey: ['myVote', event?.id],
    queryFn: () => api.getMyVote(event?.id || ''),
    enabled: !!event?.id,
  });

  // Initialize from existing vote
  useEffect(() => {
    if (myVoteResponse?.data) {
      const vote = myVoteResponse.data;
      setSliceCount(vote.sliceCount);
      setSelectedPizzas(
        vote.choices.map((c) => ({
          pizzaOptionId: c.pizzaOptionId,
          name: c.pizzaOption?.name || '',
          priority: c.priority,
        }))
      );
    }
  }, [myVoteResponse]);

  // Socket event subscriptions
  useEffect(() => {
    if (!event?.id || !isConnected) return;

    // Join the event room
    joinEvent(event.id);

    // Listen for vote updates
    const unsubVoteUpdate = onVoteUpdate((data) => {
      if (data.eventId === event.id) {
        setLiveVoteCount(data.voteCount);
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['event', event.id] });
        queryClient.invalidateQueries({ queryKey: ['votes', event.id] });
      }
    });

    // Listen for when someone submits a vote
    const unsubVoteSubmitted = onVoteSubmitted((data) => {
      if (data.eventId === event.id) {
        setToast({ message: `${data.userName} just voted!`, type: 'info' });
      }
    });

    return () => {
      leaveEvent(event.id);
      unsubVoteUpdate();
      unsubVoteSubmitted();
    };
  }, [event?.id, isConnected, joinEvent, leaveEvent, onVoteUpdate, onVoteSubmitted, queryClient]);

  // Submit vote mutation
  const submitMutation = useMutation({
    mutationFn: (data: VoteInput) => api.submitVote(event!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVote', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['votes', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['report', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['event', event?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeEvent'] });
      // Select a random quote for the confirmation modal
      setRandomQuote(FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)]);
      setShowConfirmation(true);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to submit vote');
    },
  });

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    navigate('/');
  };

  // useCallback must be called before any conditional returns (Rules of Hooks)
  const handleDeadlineExpired = useCallback(() => {
    if (event?.id) {
      navigate(`/results/${event.id}`);
    }
  }, [navigate, event?.id]);

  if (eventLoading) {
    return <LoadingScreen />;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <Pizza className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text mb-2">No Active Event</h2>
        <p className="text-text-muted">There's no event to vote on right now.</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Go Home
        </Button>
      </div>
    );
  }

  const deadline = new Date(event.deadline);
  const isDeadlinePassed = deadline < new Date();

  if (isDeadlinePassed) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text mb-2">Voting Closed</h2>
        <p className="text-text-muted">The deadline for this event has passed.</p>
        <Button onClick={() => navigate(`/results/${event.id}`)} className="mt-4">
          View Results
        </Button>
      </div>
    );
  }

  const pizzaOptions = event.pizzaOptions || [];
  const availablePizzas = pizzaOptions.filter(
    (p) => !selectedPizzas.some((s) => s.pizzaOptionId === p.id)
  );

  const handleSelectPizza = (pizza: PizzaOption) => {
    if (selectedPizzas.length >= 3) return;

    const nextPriority = (selectedPizzas.length + 1) as 1 | 2 | 3;
    setSelectedPizzas([
      ...selectedPizzas,
      {
        pizzaOptionId: pizza.id,
        name: pizza.name,
        priority: nextPriority,
      },
    ]);
  };

  const handleRemovePizza = (pizzaOptionId: string) => {
    const filtered = selectedPizzas.filter((p) => p.pizzaOptionId !== pizzaOptionId);
    // Re-assign priorities
    const updated = filtered.map((p, index) => ({
      ...p,
      priority: (index + 1) as 1 | 2 | 3,
    }));
    setSelectedPizzas(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = selectedPizzas.findIndex((p) => p.pizzaOptionId === active.id);
    const newIndex = selectedPizzas.findIndex((p) => p.pizzaOptionId === over.id);

    const newArray = [...selectedPizzas];
    const [moved] = newArray.splice(oldIndex, 1);
    newArray.splice(newIndex, 0, moved);

    // Re-assign priorities based on new order
    const updated = newArray.map((p, index) => ({
      ...p,
      priority: (index + 1) as 1 | 2 | 3,
    }));
    setSelectedPizzas(updated);
  };

  const handleSubmit = () => {
    setError('');

    if (selectedPizzas.length !== 3) {
      setError('Please select exactly 3 pizza choices');
      return;
    }

    if (sliceCount < 1 || sliceCount > 4) {
      setError('Slice count must be between 1 and 4');
      return;
    }

    submitMutation.mutate({
      sliceCount,
      choices: selectedPizzas.map((p) => ({
        pizzaOptionId: p.pizzaOptionId,
        priority: p.priority,
      })),
    });
  };

  const displayVoteCount = liveVoteCount ?? event._count?.votes ?? 0;

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-text">{event.name}</h1>
        <div className="flex items-center gap-4 mt-1">
          <CountdownTimer
            deadline={event.deadline}
            onExpire={handleDeadlineExpired}
          />
          <span className="flex items-center gap-1 text-sm text-text-muted">
            <Users className="w-4 h-4" />
            {displayVoteCount} {displayVoteCount === 1 ? 'vote' : 'votes'}
            {isConnected && (
              <span className="w-2 h-2 rounded-full bg-green-500 ml-1" title="Live updates active" />
            )}
          </span>
        </div>
      </div>

      {/* Slice Count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How many slices will you eat?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSliceCount(Math.max(1, sliceCount - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              disabled={sliceCount <= 1}
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-4xl font-bold text-primary w-16 text-center">{sliceCount}</span>
            <button
              onClick={() => setSliceCount(Math.min(4, sliceCount + 1))}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              disabled={sliceCount >= 4}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Selected Pizzas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Top 3 Choices</CardTitle>
          <p className="text-sm text-text-muted">Drag to reorder priority (1st = highest)</p>
        </CardHeader>
        <CardContent>
          {selectedPizzas.length === 0 ? (
            <p className="text-center text-text-muted py-4">
              Select 3 pizzas from the options below
            </p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={selectedPizzas.map((p) => p.pizzaOptionId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {selectedPizzas.map((pizza) => (
                    <SortablePizzaItem
                      key={pizza.pizzaOptionId}
                      pizza={pizza}
                      onRemove={() => handleRemovePizza(pizza.pizzaOptionId)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Available Pizzas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Pizzas</CardTitle>
        </CardHeader>
        <CardContent>
          {availablePizzas.length === 0 ? (
            <p className="text-center text-text-muted py-4">
              All pizzas have been selected
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availablePizzas.map((pizza) => (
                <button
                  key={pizza.id}
                  onClick={() => handleSelectPizza(pizza)}
                  disabled={selectedPizzas.length >= 3}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    selectedPizzas.length >= 3
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-text-muted cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-900/30'
                  )}
                >
                  <div className="font-medium text-sm">{pizza.name}</div>
                  <div className="text-xs text-text-muted mt-1">
                    {pizza.toppings.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        className="w-full"
        size="lg"
        disabled={selectedPizzas.length !== 3}
        isLoading={submitMutation.isPending}
      >
        {myVoteResponse?.data ? 'Update Vote' : 'Submit Vote'}
      </Button>

      {/* Vote Confirmation Modal */}
      <Modal isOpen={showConfirmation} onClose={handleConfirmationClose}>
        <div className="text-center py-4">
          <img
            src="/logo.png"
            alt="Eli's Pizza Picker"
            className="h-48 w-auto mx-auto mb-6"
          />
          <h2 className="text-xl font-bold text-text mb-2">Vote Recorded</h2>
          <p className="text-text-muted mb-4">
            Eli thanks you for your contribution, and like she always says:
          </p>
          {randomQuote && (
            <blockquote className="mb-6 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border-l-4 border-primary-500">
              <p className="text-text italic mb-2">"{randomQuote.quote}"</p>
              <footer className="text-text-muted text-sm">— {randomQuote.character}</footer>
            </blockquote>
          )}
          <Button onClick={handleConfirmationClose} className="w-full" size="lg">
            Back to Home
          </Button>
        </div>
      </Modal>
    </div>
  );
}

interface SortablePizzaItemProps {
  pizza: SelectedPizza;
  onRemove: () => void;
}

function SortablePizzaItem({ pizza, onRemove }: SortablePizzaItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pizza.pizzaOptionId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    1: 'bg-accent-500',
    2: 'bg-secondary-500',
    3: 'bg-primary-500',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg',
        isDragging && 'opacity-50'
      )}
    >
      <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-text-muted" />
      </button>
      <span
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white',
          priorityColors[pizza.priority]
        )}
      >
        {pizza.priority}
      </span>
      <span className="flex-1 font-medium text-text">{pizza.name}</span>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Minus className="w-4 h-4 text-text-muted" />
      </button>
    </div>
  );
}
