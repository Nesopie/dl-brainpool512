const { assert, log } = require("console");
const path = require("path");
const Scalar = require("ffjavascript").Scalar;
const wasm_tester = require("circom_tester").wasm;

function bigintToArray(n, k, x) {
  let mod = BigInt(1);
  for (let idx = 0; idx < n; idx++) {
    mod *= BigInt(2);
  }

  const ret = [];
  let xTemp = x;
  for (let idx = 0; idx < k; idx++) {
    ret.push(xTemp % mod);
    xTemp /= mod;
  }

  return ret;
}

function modInverse(a, m) {
  a = BigInt(a);
  m = BigInt(m);

  let m0 = m;
  let x0 = BigInt(0);
  let x1 = BigInt(1);

  if (m === 1n) return 0n;

  while (a > 1n) {
    let q = a / m;
    let t = m;

    m = a % m;
    a = t;
    t = x0;

    x0 = x1 - q * x0;
    x1 = t;
  }

  if (x1 < 0n) {
    x1 += m0;
  }

  return x1;
}

function point_double(x1, y1, a, p) {
  x1 = BigInt(x1);
  y1 = BigInt(y1);
  a = BigInt(a);
  p = BigInt(p);

  if (y1 === 0n) {
    return { x: null, y: null };
  }

  let lambda_num = (3n * x1 * x1 + a) % p;
  let lambda_den = modInverse(2n * y1, p);
  let lam = (lambda_num * lambda_den) % p;

  let x3 = (lam * lam - 2n * x1) % p;
  let y3 = (lam * (x1 - x3) - y1) % p;

  if (x3 < 0n) x3 += p;
  if (y3 < 0n) y3 += p;

  return { x: x3, y: y3 };
}

function point_add(x1, y1, x2, y2, p) {
  x1 = BigInt(x1);
  y1 = BigInt(y1);
  x2 = BigInt(x2);
  y2 = BigInt(y2);
  p = BigInt(p);

  if (x1 === x2 && y1 === y2) {
    throw new Error("Points are the same; use point_double instead.");
  }

  if (x1 === x2) {
    return { x: null, y: null };
  }
  let lambda_num = (p + y2 - y1) % p;
  let lambda_den = modInverse((p + x2 - x1) % p, p);
  let lam = (lambda_num * lambda_den) % p;

  let x3 = (2n * p + lam * lam - x1 - x2) % p;
  let y3 = (p + lam * (x1 - x3) - y1) % p;

  if (x3 < 0n) x3 += p;
  if (y3 < 0n) y3 += p;

  return { x: x3, y: y3 };
}

function point_scalar_mul(x, y, k, a, p) {
  let x_res = null;
  let y_res = null;

  let x_cur = x;
  let y_cur = y;

  while (k > 0n) {
    if (k & 1n) {
      if (x_res === null && y_res === null) {
        x_res = x_cur;
        y_res = y_cur;
      } else {
        const { x: x_temp, y: y_temp } = point_add(
          x_res,
          y_res,
          x_cur,
          y_cur,
          p
        );
        x_res = x_temp;
        y_res = y_temp;
      }
    }

    const { x: x_temp, y: y_temp } = point_double(x_cur, y_cur, a, p);
    x_cur = x_temp;
    y_cur = y_temp;

    k >>= 1n; // Shift k right by 1 bit
  }

  return { x: x_res, y: y_res };
}

function bit_arr_to_num(arr) {
  res = 0n;
  for (var i = 0; i < arr.length; i++) {
    res += BigInt(arr[i]) * 2n ** (BigInt(arr.length) - 1n - BigInt(i));
  }
  return res;
}

//input1 = x coordinate
//input2 = y coordinate
//input3 = r
//input4 = s
//input5 = h
async function testVerNum(input1, input2, input3, input4, input5, circuit) {
  let input = [
    [bigintToArray(64, 8, input1), bigintToArray(64, 8, input2)],
    [bigintToArray(64, 8, input3), bigintToArray(64, 8, input4)],
    bigintToArray(64, 8, input5),
  ];

  let n =
    0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca70330870553e5c414ca92619418661197fac10471db1d381085ddaddb58796829ca90069n;

  let sinv = modInverse(input4, n);
  let sh = (sinv * input5) % n;
  let sr = (sinv * input3) % n;
  let p1 = point_scalar_mul(
    input1,
    input2,
    sr,
    0x7830a3318b603b89e2327145ac234cc594cbdd8d3df91610a83441caea9863bc2ded5d5aa8253aa10a2ef1c98b9ac8b57f1117a72bf2c7b9e7c1ac4d77fc94can,
    0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca703308717d4d9b009bc66842aecda12ae6a380e62881ff2f2d82c68528aa6056583a48f3n
  );
  let p2 = point_scalar_mul(
    0x81aee4bdd82ed9645a21322e9c4c6a9385ed9f70b5d916c1b43b62eef4d0098eff3b1f78e2d0d48d50d1687b93b97d5f7c6d5047406a5e688b352209bcb9f822n,
    0x7dde385d566332ecc0eabfa9cf7822fdf209f70024a57b1aa000c55b881f8111b2dcde494a5f485e5bca4bd88a2763aed1ca2b2fa8f0540678cd1e0f3ad80892n,
    sh,
    0x7830a3318b603b89e2327145ac234cc594cbdd8d3df91610a83441caea9863bc2ded5d5aa8253aa10a2ef1c98b9ac8b57f1117a72bf2c7b9e7c1ac4d77fc94can,
    0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca703308717d4d9b009bc66842aecda12ae6a380e62881ff2f2d82c68528aa6056583a48f3n
  );

  let p3 = point_add(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    0xaadd9db8dbe9c48b3fd4e6ae33c9fc07cb308db3b3c9d20ed6639cca703308717d4d9b009bc66842aecda12ae6a380e62881ff2f2d82c68528aa6056583a48f3n
  );

  let real_result = p3.x == input3;

  console.log(real_result);

  //   try {
  //     const w = await circuit.calculateWitness(
  //       { pubkey: input[0], signature: input[1], hashed: input[2], dummy: 0n },
  //       true
  //     );

  //     if (!real_result) {
  //       throw new Error(
  //         `Expected failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5}, but it passed.`
  //       );
  //     }
  //   } catch (err) {
  //     if (real_result) {
  //       throw new Error(
  //         `Unexpected failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5}.`
  //       );
  //     } else {
  //       console.log(
  //         `Predicted failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5} correctly handled.`
  //       );
  //     }
  //   }
}

async function testVerBits(input1, input2, input3, input4, input5, circuit) {
  let input = [
    [bigintToArray(64, 8, input1), bigintToArray(64, 8, input2)],
    [bigintToArray(64, 8, input3), bigintToArray(64, 8, input4)],
    input5,
  ];

  let n =
    76884956397045344220809746629001649092737531784414529538755519063063536359079n;
  let hn = BigInt(bit_arr_to_num(input5));
  let sinv = modInverse(input4, n);
  let sh = (sinv * hn) % n;
  let sr = (sinv * input3) % n;
  let p1 = point_scalar_mul(
    input1,
    input2,
    sr,
    56698187605326110043627228396178346077120614539475214109386828188763884139993n,
    76884956397045344220809746629001649093037950200943055203735601445031516197751n
  );
  let p2 = point_scalar_mul(
    63243729749562333355292243550312970334778175571054726587095381623627144114786n,
    38218615093753523893122277964030810387585405539772602581557831887485717997975n,
    sh,
    56698187605326110043627228396178346077120614539475214109386828188763884139993n,
    76884956397045344220809746629001649093037950200943055203735601445031516197751n
  );

  let p3 = point_add(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    76884956397045344220809746629001649093037950200943055203735601445031516197751n
  );

  let real_result = p3.x == input3;

  try {
    const w = await circuit.calculateWitness(
      { pubkey: input[0], signature: input[1], hashed: input[2], dummy: 0n },
      true
    );

    if (!real_result) {
      throw new Error(
        `Expected failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5}, but it passed.`
      );
    }
  } catch (err) {
    if (real_result) {
      throw new Error(
        `Unexpected failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5}.`
      );
    } else {
      console.log(
        `Predicted failure for verification (${input1}, ${input2}), (${input3}, ${input4}) ${input5} not on curve correctly handled.`
      );
    }
  }
}

describe("Ecdsa num test", function () {
  this.timeout(10000000);
  let circuit;

  before(async () => {
    circuit = await wasm_tester(
      path.join(__dirname, "circuits", "signatures", "ecdsaNum.circom")
    );
  });

  it("Ver correct signature", async function () {
    await testVerNum(
      0x72408ddae30c3d06e2ba4dcb1377c3109679111202cdb3acccb9f728cab6032e30a90524e5295868b24e8816453980ba46dbfb0d9259dcbb574c17a5fd0907d8n,
      0x59143171c3d429a82ec2c7aebc2d6c1026aa35ae972b88bd469b0eacff28204d35be438cb67ac1a5f3dfac1a605a567acf270944181de6fd04bf119df6d58d54n,
      595713690292144220673012385899133159912603278885660621642018342093021089984123014704894313787453758466489522628081077226149222550093450005915184163773218n,
      8553850381006987311604114392602762351422806085458033623590600379725914988469790931405737302110045176991316319619429754674002935342469376524721847850496029n,
      0x2acccf0fc0f68fd7b46e4bf7157e67e1fbb456ddfb44d83f11ec20dfa9c60962n,
      circuit
    );
  });

  //   it("Ver incorrect signature, should handle failture", async function () {
  //     await testVerNum(
  //       31374990377422060663897166666788812921270243020104798068084951911347116539007n,
  //       41157152733927076370846415947227885284998856909034587685323725392788996793783n,
  //       41785691604214669431201278410214784582546070760560366208613932232380633581249n,
  //       45015635295556179986733632766516885633143292479837071894657301025399130399180n,
  //       53877815096637157910110176920073475792177340572623780182175655462294595163783n,
  //       circuit
  //     );
  //   });
});

// describe("Ecdsa bits test", function () {
//   this.timeout(10000000);
//   let circuit;

//   before(async () => {
//     circuit = await wasm_tester(
//       path.join(__dirname, "circuits", "signatures", "ecdsaBits.circom")
//     );
//   });

//   it("Ver correct signature", async function () {
//     await testVerBits(
//       31374990377422060663897166666788812921270243020104798068084951911347116539007n,
//       41157152733927076370846415947227885284998856909034587685323725392788996793783n,
//       41785691604214669431201278410214784582546070760560366208613932232380633581249n,
//       45015635295556179986733632766516885633143292479837071894657301025399130399180n,
//       [
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//       ],
//       circuit
//     );
//   });

//   it("Ver incorrect signature, should handle failture", async function () {
//     await testVerBits(
//       31374990377422060663897166666788812921270243020104798068084951911347116539007n,
//       41157152733927076370846415947227885284998856909034587685323725392788996793783n,
//       41785691604214669431201278410214784582546070760560366208613932232380633581249n,
//       45015635295556179986733632766516885633143292479837071894657301025399130399180n,
//       [
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         1n,
//         1n,
//         0n,
//         1n,
//         0n,
//         0n,
//         0n,
//         0n,
//         1n,
//         1n,
//         1n,
//       ],
//       circuit
//     );
//   });
// });
