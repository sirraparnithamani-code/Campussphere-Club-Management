import bcrypt from 'bcryptjs';
import { db } from './db.js';
const categories=['Technical & Innovation','Arts, Culture & Creativity','Music & Media','Literature & Communication','Social Service & Environment','Wellness & Personal Development','Sports & Fitness','International Languages & Culture','Entertainment & Performing Arts'];
const clubs:[string,string,string][]=[
 ['Coding Club','Technical & Innovation','Code, build, and collaborate on projects with fellow makers.'],
 ['The Serene Club','Wellness & Personal Development','A welcoming space for mindfulness, calm, and wellbeing.'],
 ['Comedy Talks Club','Entertainment & Performing Arts','Bring people together through comedy, conversation, and live sets.'],
 ['Photography Club','Music & Media','Learn photography, join photo walks, and tell campus stories.'],
 ['Social Eco-Friendly Club','Social Service & Environment','Take practical action for a cleaner, more sustainable campus.'],
 ['Arts - Craft and Cultural Club','Arts, Culture & Creativity','Explore hands-on crafts and celebrate art across cultures.'],
 ['Japanese Club','International Languages & Culture','Practice Japanese language and explore Japanese culture together.'],
 ['Penlighten Club','Literature & Communication','Read, write, edit, and share ideas with the campus writing community.'],
 ['Sports Club','Sports & Fitness','Find a team, stay active, and enjoy recreational sport.'],
 ['Short Film Club','Music & Media','Write, shoot, and screen short films made on campus.'],
 ['Speak 3D','Literature & Communication','Build confident communication through speaking and discussion.'],
 ['Hitband','Music & Media','Make music together, rehearse, and perform for campus audiences.'],
 ['Youth for Seva','Social Service & Environment','Volunteer on community projects and make service part of campus life.'],
 ['Sculpture Club','Arts, Culture & Creativity','Shape ideas into sculpture through shared studio practice.'],
 ['Rehash Club','Arts, Culture & Creativity','Remake, repair, and reimagine materials through creative reuse.'],
 ['Podcast Club','Music & Media','Plan, record, and publish conversations and campus stories.'],
 ['Fashify Club','Arts, Culture & Creativity','Explore fashion, styling, and design through collaborative projects.'],
 ['Self Defense','Wellness & Personal Development','Practice practical self-defense skills and build confidence.'],
 ['Korean Club','International Languages & Culture','Practice Korean language and enjoy Korean culture and media.'],
 ['Let’s Nacho','Entertainment & Performing Arts','Dance, perform, and celebrate through lively campus events.'],
 ['Hackathon Club','Technical & Innovation','Turn ideas into prototypes with collaborative coding challenges.'],
 ['Minds Club','Wellness & Personal Development','Create room for thoughtful conversations and personal growth.']
];
const aliases:[string,string,string][]=[
 ['Creative Coding Society','Coding Club','Technical & Innovation'],
 ['Campus Green Team','Social Eco-Friendly Club','Social Service & Environment'],
 ['Culture Collective','Arts - Craft and Cultural Club','Arts, Culture & Creativity']
];
const users=[['admin@campussphere.local','admin','Campus Administrator',null],['coordinator@campussphere.local','coordinator','Jordan Lee',null],['student@campussphere.local','student','Avery Morgan','CS2026001']] as const;
export function runSeed(enabled=(process.env.CAMPUSSPHERE_SEED==='true'&&process.env.NODE_ENV!=='production')||process.env.CAMPUSSPHERE_DEMO_MODE==='true',password=process.env.CAMPUSSPHERE_SEED_PASSWORD??''){
 if(!enabled)return false;const productionDemo=process.env.NODE_ENV==='production'&&process.env.CAMPUSSPHERE_DEMO_MODE==='true';if(process.env.NODE_ENV==='production'&&!productionDemo)throw new Error('Production seeding requires the explicit portfolio demo mode.');const minimum=productionDemo?16:12;if(password.length<minimum)throw new Error(`CAMPUSSPHERE_SEED_PASSWORD must contain at least ${minimum} characters.`);
 const hashed=bcrypt.hashSync(password,12);db.exec('BEGIN IMMEDIATE');
 try{
  const categoryInsert=db.prepare('INSERT INTO categories(name) VALUES(?) ON CONFLICT(name) DO NOTHING');for(const category of categories)categoryInsert.run(category);
  const categoryId=(name:string)=>(db.prepare('SELECT id FROM categories WHERE name=?').get(name) as {id:number}).id;
  for(const [oldName,newName,category] of aliases){const exists=db.prepare('SELECT id FROM clubs WHERE name=?').get(newName);if(!exists)db.prepare('UPDATE clubs SET name=?,category=?,category_id=? WHERE name=?').run(newName,category,categoryId(category),oldName);}
  const insertClub=db.prepare(`INSERT INTO clubs(name,category,category_id,description,policy) VALUES(?,?,?,?, 'open') ON CONFLICT(name) DO UPDATE SET category=excluded.category,category_id=excluded.category_id,description=CASE WHEN clubs.description='' THEN excluded.description ELSE clubs.description END`);
  for(const [name,category,description] of clubs)insertClub.run(name,category,categoryId(category),description);
  // Bring any legacy/custom category text into the relational category catalog without dropping the record.
  const existing=db.prepare('SELECT DISTINCT category FROM clubs').all() as Array<{category:string}>;
  for(const {category} of existing){if(!category)continue;categoryInsert.run(category);const id=categoryId(category);db.prepare('UPDATE clubs SET category_id=? WHERE category=?').run(id,category);}
  const insertUser=db.prepare(`INSERT INTO users(email,password_hash,role,name,student_id) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,role=excluded.role,name=excluded.name,student_id=excluded.student_id,status='active'`);
  for(const [email,role,name,id] of users)insertUser.run(email,hashed,role,name,id);
  const coordinator=db.prepare("SELECT id FROM users WHERE email='coordinator@campussphere.local'").get() as {id:number};const coding=db.prepare("SELECT id FROM clubs WHERE name='Coding Club'").get() as {id:number};db.prepare('INSERT OR IGNORE INTO club_coordinators(club_id,user_id) VALUES(?,?)').run(coding.id,coordinator.id);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return true;
}
if(process.argv[1]?.endsWith('seed.ts')||process.argv[1]?.endsWith('seed.js')){if(runSeed())console.log(`Seeded ${clubs.length} required CampusSphere clubs and ${users.length} demo accounts.`);else console.log('Seeding disabled. Set CAMPUSSPHERE_SEED=true in development to seed demo accounts.');}

