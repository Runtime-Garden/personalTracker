/** Deliberately narrow allowlist. Returned media is for metadata; downloads are forced attachments. */
export function sniffAttachment(buf:Buffer):string|null{
 if(buf.length>=4&&buf.subarray(0,4).equals(Buffer.from('%PDF')))return 'application/pdf';
 if(buf.length>=8&&buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
 if(buf.length>=3&&buf.subarray(0,3).equals(Buffer.from('ffd8ff','hex')))return 'image/jpeg';
 if(buf.length>=12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(buf.length&&buf.length<=5*1024*1024&&!buf.includes(0)&&!buf.toString('utf8').includes('\uFFFD'))return 'text/plain';
 return null;
}
export function safeAttachmentName(name:string){
 return name.length>0&&name.length<=200&&!/[\x00-\x1f\\/]/.test(name)&&name!=='.'&&name!=='..';
}
export function nextWallClock(time:string,zone:string,cadence:'daily'|'weekly'|'monthly'):string{
 // PostgreSQL is authoritative for recurrence scheduling. This function exists only for UI validation hints.
 // Do not derive a new stored instant in JavaScript from a UTC increment.
 if(!['daily','weekly','monthly'].includes(cadence))throw Error('Invalid cadence');
 new Intl.DateTimeFormat('en',{timeZone:zone});
 return time;
}
