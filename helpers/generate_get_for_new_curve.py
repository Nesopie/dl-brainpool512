P = 0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca703308717d4d9b009bc66842aecda12ae6a380e62881ff2f2d82c68528aa6056583a48f3
A = 0x7830a3318b603b89e2327145ac234cc594cbdd8d3df91610a83441caea9863bc2ded5d5aa8253aa10a2ef1c98b9ac8b57f1117a72bf2c7b9e7c1ac4d77fc94ca
B = 0x3df91610a83441caea9863bc2ded5d5aa8253aa10a2ef1c98b9ac8b57f1117a72bf2c7b9e7c1ac4d77fc94cadc083e67984050b75ebae5dd2809bd638016f723
Gx = 0x81aee4bdd82ed9645a21322e9c4c6a9385ed9f70b5d916c1b43b62eef4d0098eff3b1f78e2d0d48d50d1687b93b97d5f7c6d5047406a5e688b352209bcb9f822
Gy = 0x7dde385d566332ecc0eabfa9cf7822fdf209f70024a57b1aa000c55b881f8111b2dcde494a5f485e5bca4bd88a2763aed1ca2b2fa8f0540678cd1e0f3ad80892
N = 0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca70330870553e5c414ca92619418661197fac10471db1d381085ddaddb58796829ca90069
chunk_size = 64
chunk_number = 8

def mod_inverse(a, m):
    m0, x0, x1 = m, 0, 1
    while a > 1:
        q = a // m
        m, a = a % m, m
        x0, x1 = x1 - q * x0, x0
    if x1 < 0:
        x1 += m0
    return x1


def bigint_to_array(n, k, x):
    # Initialize mod to 1 (Python's int can handle arbitrarily large numbers)
    mod = 1
    for idx in range(n):
        mod *= 2

    # Initialize the return list
    ret = []
    x_temp = x
    for idx in range(k):
        # Append x_temp mod mod to the list
        ret.append(str(x_temp % mod))
        # Divide x_temp by mod for the next iteration
        x_temp //= mod  # Use integer division in Python

    return ret
def point_double(x1, y1, a, p):
    if y1 == 0:
        # Point at infinity (edge case for doubling)
        return None, None

    # Calculate λ (lambda)
    lambda_num = (3 * x1 * x1 + a) % p
    lambda_den = mod_inverse(2 * y1, p)  # Modular inverse of 2*y1 mod p
    lam = (lambda_num * lambda_den) % p

    # Calculate x3 and y3
    x3 = (lam * lam - 2 * x1) % p
    y3 = (lam * (x1 - x3) - y1) % p

    return x3, y3

def point_add(x1, y1, x2, y2, p):

    lambda_num = (y2 - y1) % p
    lambda_den = mod_inverse((x2 - x1) % p, p) 
    lam = (lambda_num * lambda_den) % p
    x3 = (lam * lam - x1 - x2) % p
    # print(bigint_to_array(64, 4, x3))

    y3 = (lam * (x1 - x3) - y1) % p

    return x3, y3

def point_scalar_mul(x, y, k, a, p):
    x_res, y_res = None, None  

    x_cur, y_cur = x, y

    while k > 0:
        if k & 1:
            if x_res is None and y_res is None:
                x_res, y_res = x_cur, y_cur
            else:
                x_res, y_res = point_add(x_res, y_res, x_cur, y_cur, p)

        x_cur, y_cur = point_double(x_cur, y_cur, a, p)

        k >>= 1

    return x_res, y_res

x1, y1 = point_double(Gx, Gy, A, P)
for i in range(255):
    x1, y1 = point_double(x1, y1, A, P)

if_str = "\t\tif ("
idx = 0
for chunk in bigint_to_array(chunk_size, chunk_number, P):
    if_str += "P[{idx}] == {chunk} && ".format(idx = idx, chunk = chunk)
    idx+=1
if_str = if_str[:-3] + "){\n"

get_gen_str = if_str
get_gen_str += "\t\t\tgen[0] <== ["
for chunk in bigint_to_array(chunk_size, chunk_number, Gx):
    get_gen_str += "{chunk}, ".format(chunk = int(chunk))
get_gen_str = get_gen_str[:-2] + "];\n"
get_gen_str += "\t\t\tgen[1] <== ["
for chunk in bigint_to_array(chunk_size, chunk_number, Gy):
    get_gen_str += "{chunk}, ".format(chunk = int(chunk))
get_gen_str = get_gen_str[:-2] + "];\n\t\t}\n"

get_dummy_str = if_str
get_dummy_str += "\t\t\tdummyPoint[0] <== ["
for chunk in bigint_to_array(chunk_size, chunk_number, x1):
    get_dummy_str += "{chunk}, ".format(chunk = int(chunk))
get_dummy_str = get_dummy_str[:-2] + "];\n"
get_dummy_str += "\t\t\tdummyPoint[1] <== ["
for chunk in bigint_to_array(chunk_size, chunk_number, y1):
    get_dummy_str += "{chunk}, ".format(chunk = int(chunk))
get_dummy_str = get_dummy_str[:-2] + "];\n\t\t}\n"

get_order_str = if_str
get_order_str += "\t\t\torder <== ["
for chunk in bigint_to_array(chunk_size, chunk_number, N):
    get_order_str += "{chunk}, ".format(chunk = int(chunk))
get_order_str = get_order_str[:-2] + "];\n\t\t}\n"

# print(get_gen_str)
# print(get_dummy_str)
# print(get_order_str)

file_path = "circuits/ec/get.circom"  

find_str = "if (CHUNK_NUMBER == {chunk_number})".format(chunk_number=chunk_number)
res_str = ""
try:
    with open(file_path, "r", encoding="utf-8") as file:
        file_content = file.read()
        parts = file_content.split(find_str)
        parts = file_content.split(find_str)

        parts[1] = (
            str(parts[1][:parts[1].index("\n") + 1]) 
            + get_gen_str 
            + str(parts[1][parts[1].index("\n") + 1:])
        )

        parts[2] = (
            str(parts[2][:parts[2].index("\n") + 1]) 
            + get_dummy_str 
            + str(parts[2][parts[2].index("\n") + 1:])
        )

        parts[3] = (
            str(parts[3][:parts[3].index("\n") + 1]) 
            + get_order_str 
            + str(parts[3][parts[3].index("\n") + 1:])
        )

        res_str = find_str.join(parts)
except FileNotFoundError:
    print(f"RUN THIS FROM ROOT!!!!!!!!!!!")

try:
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(res_str)
except FileNotFoundError:
    print(f"RUN THIS FROM ROOT!!!!!!!!!!!")