import {PrismaClient} from '@prisma/client';import bcrypt from 'bcryptjs';
const db=new PrismaClient();
for(const name of ['Retail Banking','Corporate Banking','Insurance','Capital Markets','Payments'])await db.department.upsert({where:{name},update:{},create:{name}});
await db.user.upsert({where:{email:'admin@shc.local'},update:{},create:{email:'admin@shc.local',password:await bcrypt.hash('Admin@123',10)}});
const cl=await db.client.upsert({where:{name:'Default client'},update:{},create:{name:'Default client'}});
const cat=await db.category.upsert({where:{name:'Access'},update:{},create:{name:'Access'}});
const dep=n=>db.department.findUnique({where:{name:n}}).then(d=>d.id);
const A=[['KB-101','Retail Banking','Reset a locked online banking password','Unlock the user in the identity console and issue a temporary password.',['Verify identity','Run unlock script','Send temporary password'],'unlock-user.sh'],
['KB-102','Retail Banking','Restore VPN connection for branch staff','Restart the VPN client service and refresh the gateway certificate.',['Restart VPN client','Refresh certificate','Test tunnel'],null],
['KB-103','Retail Banking','Database connection pool exhausted','Recycle idle connections and raise the pool limit.',['Find idle sessions','Recycle pool'],null],
['KB-301','Insurance','Claims form fails to upload attachments','Raise the upload limit and clear temporary storage.',['Check size limit','Clear temp storage'],null],
['KB-501','Payments','Card payment gateway timeout','Fail over to the secondary gateway endpoint.',['Check gateway health','Switch endpoint'],null]];
for(const [code,d,title,summary,steps,script] of A)await db.article.upsert({where:{code},update:{},create:{code,title,summary,steps:JSON.stringify(steps),script,departmentId:await dep(d),clientId:cl.id,categoryId:cat.id}});
console.log('Seeded');process.exit(0);
