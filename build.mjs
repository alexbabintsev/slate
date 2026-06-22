import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');

// Curated lucide subset shipped with the extension. Filtered from the full
// set in assets/lucide-icons.full.json at build time.
const ICON_SET = [
  // Folders / files
  'Folder','FolderOpen','FolderPlus','FolderGit','FolderKanban','FolderTree','FolderHeart','FolderArchive',
  'File','FileText','FileCode2','FileImage','FileVideo','FileAudio','FileSpreadsheet','FileJson','FilePlus','Files',
  'Archive','Inbox','Box','Package','Boxes','PackageOpen',
  // Workspaces / projects
  'Briefcase','BriefcaseBusiness','Building','Building2','Home','Hotel','Store','Warehouse','Factory','School','Hospital','Library',
  'Layers','LayoutDashboard','LayoutGrid','LayoutList','Kanban','Table','Columns3','Rows3',
  // Dev / code
  'Code','Code2','Terminal','TerminalSquare','Bug','GitBranch','GitCommit','GitMerge','GitPullRequest','GitFork',
  'Database','Server','HardDrive','Cpu','MemoryStick','Container',
  // Web / cloud
  'Globe','Globe2','Cloud','CloudDownload','CloudUpload','Wifi','WifiOff','Network','Link','Link2','ExternalLink',
  // Security / auth
  'Lock','LockKeyhole','Unlock','Key','KeyRound','Shield','ShieldCheck','ShieldAlert','Fingerprint','Eye','EyeOff',
  // Settings / tools
  'Settings','Settings2','Wrench','Hammer','SlidersHorizontal','SlidersVertical','ToggleLeft','ToggleRight','Cog',
  // Status / signals
  'Zap','Bell','BellOff','BellRing','Flag','Bookmark','Star','StarHalf','Heart','HeartHandshake','Award','Trophy','Crown','Gem','Sparkles',
  'CheckCircle2','Check','CheckCheck','X','XCircle','AlertCircle','AlertTriangle','Info','HelpCircle','CircleDot',
  // Actions
  'Plus','Minus','Edit','Edit2','Edit3','Pencil','Trash','Trash2','Save','Download','Upload','Copy','Clipboard','ClipboardCopy','Share','Share2','Send',
  'Search','Filter','SortAsc','SortDesc','RefreshCw','RotateCcw','RotateCw','Repeat','Undo','Redo',
  'Play','Pause','Square','SkipBack','SkipForward','FastForward','Rewind','Volume2','VolumeX','Mic','MicOff',
  // Navigation
  'ChevronLeft','ChevronRight','ChevronUp','ChevronDown','ChevronsLeft','ChevronsRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Move','GripVertical','Menu','MoreHorizontal','MoreVertical',
  // Communication
  'Mail','MailOpen','MessageSquare','MessageCircle','Phone','PhoneCall','Video','VideoOff','AtSign','Hash',
  // Time / data
  'Clock','Calendar','CalendarDays','CalendarCheck','Timer','Hourglass','History',
  'BarChart','BarChart2','BarChart3','LineChart','PieChart','TrendingUp','TrendingDown','Activity','Gauge',
  'DollarSign','Euro','PoundSterling','Bitcoin','Wallet','CreditCard','Receipt','ShoppingCart','ShoppingBag',
  // Media
  'Image','Images','Camera','Film','Music','Music2','Headphones','Radio','Tv','Tv2','Speaker','Disc','Album','Podcast',
  'Palette','Brush','PenTool','Paintbrush','Pipette','Eraser','Type','Pilcrow','Bold','Italic',
  // Devices
  'Monitor','MonitorSmartphone','Smartphone','Tablet','Laptop','Laptop2','Watch','Mouse','Keyboard','Printer','Scan','QrCode','Usb','Bluetooth','Battery','Plug','Power',
  // Objects / fun
  'Coffee','Beer','Wine','Pizza','Cookie','UtensilsCrossed','Apple','Cherry',
  'Gamepad2','Dices','Puzzle','Joystick','Rocket','Plane','Car','Bus','Bike','Ship','Train','Tractor',
  'Sun','Moon','CloudRain','CloudSnow','Umbrella','Snowflake','Flame','Droplet','Leaf','Trees','TreeDeciduous','TreePine','Sprout','Flower','Cat','Dog','Bird','Fish',
  // People
  'User','UserPlus','UserMinus','UserCheck','UserX','Users','UserCircle','UserCog','UserSearch','Contact',
  // Misc
  'Lightbulb','LightbulbOff','Target','Crosshair','Compass','Map','MapPin','Navigation','Anchor','Mountain','Tent','Castle',
  'Tag','Tags','Pin','PinOff','Paperclip','Scissors','Ruler','Calculator','Atom','Beaker','FlaskConical','Microscope','Telescope','Dna','TestTube','Pill','Syringe','Stethoscope','Bandage',
  'Book','BookOpen','BookOpenCheck','BookMarked','BookText','GraduationCap','Newspaper','PartyPopper','Cake','Gift','Ticket',
];

function buildIconSet() {
  const full = JSON.parse(readFileSync('assets/lucide-icons.full.json', 'utf8'));
  const unique = [...new Set(ICON_SET)];
  const missing = unique.filter(n => !full[n]);
  if (missing.length) {
    throw new Error(`Curated icons missing from lucide source: ${missing.join(', ')}`);
  }
  const filtered = Object.fromEntries(unique.map(n => [n, full[n]]));
  writeFileSync('assets/lucide-icons.json', JSON.stringify(filtered));
  const sizeKB = (JSON.stringify(filtered).length / 1024).toFixed(1);
  console.log(`  assets/lucide-icons.json  ${sizeKB}kb  (${unique.length} icons)`);
}

buildIconSet();

const entryPoints = [
  { in: 'src/background/service-worker.ts', out: 'dist/service-worker' },
  { in: 'src/popup/popup.ts', out: 'src/popup/popup' },
  { in: 'src/manager/manager.ts', out: 'src/manager/manager' },
];

const config = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context({
    ...config,
    entryPoints: entryPoints.map(e => ({ in: e.in, out: e.out })),
    outdir: '.',
    outExtension: { '.js': '.js' },
  });
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build({
    ...config,
    entryPoints: entryPoints.map(e => ({ in: e.in, out: e.out })),
    outdir: '.',
    outExtension: { '.js': '.js' },
  });
}
