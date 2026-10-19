export function withinQuietHours(now:Date,zone:string,start:string|null,end:string|null){
 if(!start||!end||start.slice(0,5)===end.slice(0,5))return false;
 const current=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:zone}).format(now);
 const a=start.slice(0,5),b=end.slice(0,5);
 return a<b?current>=a&&current<b:current>=a||current<b;
}
