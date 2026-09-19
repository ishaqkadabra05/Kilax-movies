import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

void main() => runApp(const KilaxApp());

const bg = Color(0xFF07080F);
const surface = Color(0xFF0E1020);
const card = Color(0xFF131528);
const blue = Color(0xFF2563EB);
const textPrimary = Color(0xFFF1F5F9);
const muted = Color(0xFF94A3B8);

class Movie {
  final String title, image, vj, genre;
  final int year;
  final double rating;
  const Movie(this.title, this.image, this.vj, this.genre, this.year, this.rating);
}

const movies = [
  Movie('The Last Horizon','https://images.unsplash.com/photo-1655114722721-5c75114be5ab?w=800','VJ Junior','Action / Thriller',2025,8.7),
  Movie('Void Protocol','https://images.unsplash.com/photo-1702499903230-867455db1752?w=800','VJ Ice P','Sci-Fi / Drama',2024,8.2),
  Movie('Night Circuit','https://images.unsplash.com/photo-1637059880830-59a90102de77?w=800','VJ Mark','Crime / Thriller',2024,7.9),
  Movie('Orbital Drift','https://images.unsplash.com/photo-1536697246787-1f7ae568d89a?w=500','VJ Junior','Sci-Fi',2025,8.4),
  Movie('Crimson Veil','https://images.unsplash.com/photo-1634733049839-0292be607569?w=500','VJ Ice P','Drama',2025,7.8),
  Movie('Dark Meridian','https://images.unsplash.com/photo-1675726205553-4e348f24da2c?w=500','VJ Mark','Crime',2024,8.1),
];

class KilaxApp extends StatelessWidget {
  const KilaxApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Kilax Movies',
    theme: ThemeData.dark(useMaterial3: true).copyWith(
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme.fromSeed(seedColor: blue, brightness: Brightness.dark),
      fontFamily: 'Arial',
    ),
    home: const Shell(),
  );
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override State<Shell> createState() => _ShellState();
}
class _ShellState extends State<Shell> {
  int index = 0;
  final pages = const [HomePage(), ListingPage(title:'Movies'), ListingPage(title:'Series'), SportsPage(), ProfilePage()];
  @override
  Widget build(BuildContext context) => Scaffold(
    drawer: const AppDrawer(),
    body: pages[index],
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: NavigationBar(
            height: 68,
            backgroundColor: surface,
            indicatorColor: blue.withOpacity(.25),
            selectedIndex: index,
            onDestinationSelected: (v) => setState(() => index=v),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label:'Home'),
              NavigationDestination(icon: Icon(Icons.movie_outlined), selectedIcon: Icon(Icons.movie), label:'Movies'),
              NavigationDestination(icon: Icon(Icons.tv_outlined), selectedIcon: Icon(Icons.tv), label:'Series'),
              NavigationDestination(icon: Icon(Icons.emoji_events_outlined), selectedIcon: Icon(Icons.emoji_events), label:'Sports'),
              NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label:'Profile'),
            ],
          ),
        ),
      ),
    ),
  );
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});
  @override Widget build(BuildContext context) => Drawer(
    backgroundColor: surface,
    child: SafeArea(child: ListView(padding: const EdgeInsets.all(18), children: [
      Row(children: [
        Image.asset('assets/images/kilax-logo.jpg', width: 54, height: 54, fit: BoxFit.cover),
        const SizedBox(width: 12),
        const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Kilax Movies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          Text('Welcome back', style: TextStyle(color: muted)),
        ]),
      ]),
      const SizedBox(height: 24),
      _item(context, Icons.download_outlined, 'My Downloads', const DownloadsPage()),
      _item(context, Icons.history, 'Continue Watching', const ContinuePage()),
      _item(context, Icons.bookmark_outline, 'My List', const MyListPage()),
      _item(context, Icons.notifications_none, 'Notifications', const NotificationsPage()),
      const Divider(color: Colors.white12),
      _item(context, Icons.workspace_premium_outlined, 'Subscription', const SubscriptionPage()),
      _item(context, Icons.public, 'Visit Website', null, url:'https://kilaxmovies.com'),
      const Divider(color: Colors.white12),
      _item(context, Icons.support_agent, 'Contact Support', const ContactPage()),
      _item(context, Icons.settings_outlined, 'Profile Settings', const ProfilePage()),
    ])),
  );
  Widget _item(BuildContext c, IconData icon, String title, Widget? page, {String? url}) => ListTile(
    leading: Icon(icon, color: muted), title: Text(title),
    onTap: () async {
      Navigator.pop(c);
      if (page != null) Navigator.push(c, MaterialPageRoute(builder: (_) => page));
      if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    },
  );
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});
  @override Widget build(BuildContext context) => CustomScrollView(slivers: [
    SliverAppBar(
      backgroundColor: bg, floating: true,
      title: Image.asset('assets/images/kilax-logo.jpg', width: 42, height: 42),
      actions: [IconButton(icon: const Icon(Icons.search), onPressed: (){}), IconButton(icon: const Icon(Icons.notifications_none), onPressed: ()=>Navigator.push(context, MaterialPageRoute(builder:(_)=>const NotificationsPage())))],
    ),
    SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16), child: _hero(context))),
    SliverToBoxAdapter(child: Section(title:'Latest Movies', items:movies.take(4).toList())),
    SliverToBoxAdapter(child: Section(title:'Latest Series', items:movies.skip(2).take(4).toList())),
    SliverToBoxAdapter(child: Section(title:'More You May Like', items:movies.reversed.take(4).toList())),
    const SliverToBoxAdapter(child: SizedBox(height: 20)),
  ]);
  Widget _hero(BuildContext c) => ClipRRect(borderRadius: BorderRadius.circular(22), child: Stack(children: [
    Image.network(movies.first.image, height: 360, width: double.infinity, fit: BoxFit.cover),
    Container(height:360, decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter,end: Alignment.bottomCenter,colors:[Colors.transparent,bg]))),
    Positioned(left:18,bottom:20,right:18,child: Column(crossAxisAlignment: CrossAxisAlignment.start, children:[
      const Text('THE LAST HORIZON', style: TextStyle(fontSize:25,fontWeight:FontWeight.bold)),
      const Text('2025  •  VJ Junior  •  Action / Thriller', style: TextStyle(color: muted)),
      const SizedBox(height:12),
      FilledButton.icon(onPressed:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>DetailsPage(movie:movies.first))), icon:const Icon(Icons.play_arrow), label:const Text('Play Now')),
    ]))
  ]));
}

class Section extends StatelessWidget {
  final String title; final List<Movie> items;
  const Section({super.key, required this.title, required this.items});
  @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.fromLTRB(16, 10, 0, 12), child: Column(children:[
    Row(children:[Expanded(child:Text(title,style:const TextStyle(fontSize:17,fontWeight:FontWeight.bold))),TextButton.icon(onPressed:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>ListingPage(title:title))),icon:const Icon(Icons.arrow_forward,size:16),label:const Text('More'))]),
    SizedBox(height:220, child: ListView.separated(scrollDirection:Axis.horizontal,itemCount:items.length,separatorBuilder:(_,__)=>const SizedBox(width:12),itemBuilder:(_,i)=>MovieCard(movie:items[i]))),
  ]));
}

class MovieCard extends StatelessWidget {
  final Movie movie; const MovieCard({super.key,required this.movie});
  @override Widget build(BuildContext c) => GestureDetector(onTap:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>DetailsPage(movie:movie))),child:SizedBox(width:126,child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
    Expanded(child:Stack(children:[
      ClipRRect(borderRadius:BorderRadius.circular(14),child:Image.network(movie.image,width:126,height:175,fit:BoxFit.cover)),
      Positioned(top:-8,left:-22,child:Transform.rotate(angle:-0.785398,child:Container(width:95,padding:const EdgeInsets.symmetric(vertical:5),color:blue,child:Text(movie.vj,textAlign:TextAlign.center,style:const TextStyle(fontSize:9,fontWeight:FontWeight.bold))))),
      Positioned(bottom:8,left:8,child:Container(padding:const EdgeInsets.symmetric(horizontal:6,vertical:3),decoration:BoxDecoration(color:Colors.black54,borderRadius:BorderRadius.circular(6)),child:Text('★ ${movie.rating}',style:const TextStyle(fontSize:10)))),
    ])),
    const SizedBox(height:5), Text(movie.title,maxLines:1,overflow:TextOverflow.ellipsis,style:const TextStyle(fontWeight:FontWeight.w400)),
    Row(children:[Text('${movie.year}',style:const TextStyle(color:muted,fontSize:11)),const Spacer(),Icon(Icons.favorite_border,size:15,color:muted)]),
  ])));
}

class ListingPage extends StatelessWidget {
  final String title; const ListingPage({super.key,required this.title});
  @override Widget build(BuildContext c) => Scaffold(appBar:AppBar(title:Text(title)),body:CustomScrollView(slivers:[
    SliverToBoxAdapter(child:SingleChildScrollView(scrollDirection:Axis.horizontal,padding:const EdgeInsets.all(12),child:Row(children:['All','Drama','Thriller','Sci-Fi','Action','Crime','Romance'].map((g)=>Padding(padding:const EdgeInsets.only(right:8),child:FilterChip(label:Text(g),selected:g=='All',onSelected:(_){},selectedColor:blue.withOpacity(.35))).toList()))),
    SliverPadding(padding:const EdgeInsets.all(12),sliver:SliverGrid(delegate:SliverChildBuilderDelegate((_,i)=>MovieCard(movie:movies[i%movies.length]),childCount:12),gridDelegate:const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount:3,crossAxisSpacing:8,mainAxisSpacing:12,childAspectRatio:.52))),
  ]));
}

class DetailsPage extends StatelessWidget {
  final Movie movie; const DetailsPage({super.key,required this.movie});
  @override Widget build(BuildContext c) => Scaffold(appBar:AppBar(title:Text(movie.title)),body:ListView(padding:const EdgeInsets.all(16),children:[
    ClipRRect(borderRadius:BorderRadius.circular(20),child:Image.network(movie.image,height:300,fit:BoxFit.cover)),
    const SizedBox(height:16),Text(movie.title,style:const TextStyle(fontSize:26,fontWeight:FontWeight.bold)),
    Text('${movie.year} • ${movie.vj} • ${movie.genre} • ★ ${movie.rating}',style:const TextStyle(color:muted)),
    const SizedBox(height:16),Wrap(spacing:8,children:[
      FilledButton.icon(onPressed:(){},icon:const Icon(Icons.play_arrow),label:const Text('Play')),
      OutlinedButton.icon(onPressed:(){},icon:const Icon(Icons.movie_outlined),label:const Text('Trailer')),
      OutlinedButton.icon(onPressed:(){},icon:const Icon(Icons.download),label:const Text('Download')),
      OutlinedButton.icon(onPressed:(){},icon:const Icon(Icons.bookmark_border),label:const Text('My List')),
    ]),
    const SizedBox(height:20),const Text('Overview',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold)),
    const SizedBox(height:8),Text('A cinematic story filled with mystery, action, and unforgettable characters. Explore the storyline and enjoy this title with your preferred VJ experience.',style:const TextStyle(color:muted,height:1.5)),
    const SizedBox(height:24),Section(title:'More Like This',items:movies.where((m)=>m.title!=movie.title).take(4).toList()),
  ]));
}

class SportsPage extends StatelessWidget { const SportsPage({super.key}); @override Widget build(BuildContext c)=>const Scaffold(body:Center(child:Text('Sports content'))); }
class ProfilePage extends StatelessWidget { const ProfilePage({super.key}); @override Widget build(BuildContext c)=>const Scaffold(body:Center(child:Text('Profile'))); }
class ContinuePage extends StatelessWidget { const ContinuePage({super.key}); @override Widget build(BuildContext c)=>const Scaffold(body:Center(child:Text('Continue Watching'))); }
class MyListPage extends StatelessWidget { const MyListPage({super.key}); @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('My List')),body:GridView.builder(padding:const EdgeInsets.all(12),gridDelegate:const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount:3,crossAxisSpacing:8,mainAxisSpacing:12,childAspectRatio:.52),itemCount:6,itemBuilder:(_,i)=>MovieCard(movie:movies[i%movies.length]))); }
class NotificationsPage extends StatelessWidget { const NotificationsPage({super.key}); @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('Notifications'),actions:[TextButton(onPressed:(){},child:const Text('Mark all read'))]),body:ListView(children:List.generate(5,(i)=>ListTile(leading:const Icon(Icons.notifications,color:blue),title:Text(['New release available','Download complete','Subscription update','New series added','System update'][i]),subtitle:const Text('Tap to view more information'),trailing:i<2?const CircleAvatar(radius:4,backgroundColor:blue):null))); }
class DownloadsPage extends StatelessWidget { const DownloadsPage({super.key}); @override Widget build(BuildContext c)=>DefaultTabController(length:2,child:Scaffold(appBar:AppBar(title:const Text('Downloads'),bottom:const TabBar(tabs:[Tab(text:'Active'),Tab(text:'Completed')])),body:TabBarView(children:[_list(true),_list(false)]))); Widget _list(bool active)=>ListView(children:List.generate(3,(i)=>ListTile(leading:Image.network(movies[i].image,width:65,fit:BoxFit.cover),title:Text(movies[i].title),subtitle:active?LinearProgressIndicator(value:(i+2)/4):const Text('Ready to watch offline'),trailing:Icon(active?Icons.pause:Icons.play_arrow)))); }
class ContactPage extends StatelessWidget { const ContactPage({super.key}); @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('Contact Support')),body:ListView(padding:const EdgeInsets.all(16),children:[_contact(c,Icons.chat,'WhatsApp','+256 780 846 800','https://wa.me/256780846800'),_contact(c,Icons.call,'Call Support','+256 744 862 843','tel:+256744862843') ])); Widget _contact(BuildContext c,IconData icon,String title,String sub,String url)=>Card(color:card,child:ListTile(leading:Icon(icon,color:blue),title:Text(title),subtitle:Text(sub),trailing:const Icon(Icons.arrow_forward),onTap:()=>launchUrl(Uri.parse(url),mode:LaunchMode.externalApplication))); }
class SubscriptionPage extends StatelessWidget { const SubscriptionPage({super.key}); @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('Subscription')),body:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Card(color:card,child:ListTile(title:Text('Current Plan'),subtitle:Text('Monthly • UGX 15,000'),trailing:Icon(Icons.workspace_premium,color:blue))),const SizedBox(height:16),FilledButton(onPressed:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>const PaymentPage())),child:const Text('Make Payment'))])); }
class PaymentPage extends StatelessWidget { const PaymentPage({super.key}); @override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:const Text('Payment')),body:Padding(padding:const EdgeInsets.all(16),child:Column(children:[DropdownButtonFormField(items:const [DropdownMenuItem(value:'Monthly',child:Text('Monthly - UGX 15,000')),DropdownMenuItem(value:'Quarterly',child:Text('Quarterly - UGX 40,000'))],onChanged:(_){},decoration:const InputDecoration(labelText:'Select plan')),const SizedBox(height:16),const TextField(decoration:InputDecoration(labelText:'Mobile Money or Card details')),const SizedBox(height:16),FilledButton(onPressed:()=>showDialog(context:c,builder:(_)=>const AlertDialog(title:Text('Payment Successful'),content:Text('Your payment confirmation is ready.'))),child:const Text('Confirm Payment'))]))); }
