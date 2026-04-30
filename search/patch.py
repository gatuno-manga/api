import os

def patch_file(path, old, new):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
    with open(path, 'r') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w') as f:
            f.write(content)
        print(f"Patched: {path}")
    else:
        print(f"Old string not found in {path}")

# 1. MySQL 8.4 compatibility
patch_file('/usr/local/lib/python3.12/site-packages/asyncmy/replication/binlogstream.py', 
           'SHOW MASTER STATUS', 'SHOW BINARY LOG STATUS')
patch_file('/meilisync/meilisync/source/mysql.py', 
           'SHOW MASTER STATUS', 'SHOW BINARY LOG STATUS')

# 2. asyncmy variable length string bug
patch_file('/usr/local/lib/python3.12/site-packages/asyncmy/replication/packets.py',
           'byte = struct.pack("!B", self.read(1))',
           'byte = self.read(1)[0]')

# 3. Bytes decoding and JSON parsing fix
decoder_code = """
import json
def decode_bytes(obj):
    if obj is None: return None
    if isinstance(obj, bytes):
        val = obj.decode('utf-8')
        stripped = val.strip()
        if (stripped.startswith('[') and stripped.endswith(']')) or (stripped.startswith('{') and stripped.endswith('}')):
            try:
                return decode_bytes(json.loads(stripped))
            except:
                return val
        return val
    if isinstance(obj, str):
        stripped = obj.strip()
        if (stripped.startswith('[') and stripped.endswith(']')) or (stripped.startswith('{') and stripped.endswith('}')):
            try:
                return decode_bytes(json.loads(stripped))
            except:
                return obj
        return obj
    if isinstance(obj, dict):
        return {decode_bytes(k): decode_bytes(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [decode_bytes(i) for i in obj]
    return obj
"""

patch_file('/meilisync/meilisync/schemas.py',
           'class Event(ProgressEvent):',
           f'{decoder_code}\nclass Event(ProgressEvent):')

patch_file('/meilisync/meilisync/schemas.py',
           'data[k] = v',
           'data[decode_bytes(k)] = decode_bytes(v)')

patch_file('/meilisync/meilisync/schemas.py',
           'data[real_k] = v',
           'data[real_k] = decode_bytes(v)')

# 4. Patch get_full_data to use our search view
full_data_patch = """
    async def get_full_data(self, sync: Sync, size: int):
        conn = await asyncmy.connect(**self.kwargs)
        async with conn.cursor(cursor=DictCursor) as cur:
            offset = 0
            while True:
                # Se for a tabela books, usamos a view de busca para pegar tudo flat
                table = "books_search_view" if sync.table == "books" else sync.table
                await cur.execute(f"SELECT * FROM {table} ORDER BY {sync.pk} LIMIT {size} OFFSET {offset}")
                ret = await cur.fetchall()
                if not ret:
                    break
                offset += size
                yield ret
"""

import re
with open('/meilisync/meilisync/source/mysql.py', 'r') as f:
    mysql_content = f.read()

new_mysql_content = re.sub(r'async def get_full_data\(self, sync: Sync, size: int\):.*?yield ret', 
                           full_data_patch.strip(), mysql_content, flags=re.DOTALL)

with open('/meilisync/meilisync/source/mysql.py', 'w') as f:
    f.write(new_mysql_content)
print("Patched get_full_data in mysql.py")
