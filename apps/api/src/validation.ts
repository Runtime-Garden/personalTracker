// Pure helpers for dependency-free regression tests.
export function isValidDay(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;}
export function isValidInstant(v:unknown):v is string{return typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(v)&&!Number.isNaN(Date.parse(v));}
export function rank(role:string):number{return ({viewer:0,member:1,admin:2,owner:3} as Record<string,number>)[role]??-1;}
export function canAccess(actual:string,minimum:string):boolean{return rank(actual)>=rank(minimum)&&rank(minimum)>=0;}
export function validateWorkspaceReference(resourceWorkspace:string,requestedWorkspace:string):boolean{return resourceWorkspace===requestedWorkspace;}
