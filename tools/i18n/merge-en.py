# Une los «N ⇒ inglés» (raw-*) con las claves en español de fr-<n>.txt y arma en-<n>.txt. Uso: python3 merge-en.py <n> raw1 [raw2…]
import sys,re
n=sys.argv[1]; d='/home/user/camara-luccianos/tools/i18n/'
ks=[l.rstrip('\n').split(' ⇒ ',1)[0] for l in open(d+f'fr-{n}.txt',encoding='utf8') if ' ⇒ ' in l]
tr={}
for f in sys.argv[2:]:
    for l in open(f,encoding='utf8'):
        m=re.match(r'(\d+) ⇒ (.*)$',l.rstrip('\n'))
        if m: tr[int(m.group(1))]=m.group(2)
falt=[i for i in range(1,len(ks)+1) if i not in tr]
print('claves',len(ks),'traducidas',len(tr),'faltan',falt[:20])
with open(d+f'en-{n}.txt','w',encoding='utf8') as o:
    for i,k in enumerate(ks,1):
        if i in tr: o.write(f'{k} ⇒ {tr[i]}\n')
