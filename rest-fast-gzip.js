import { Agent } from 'undici';
import zlib from 'zlib';

const qdrantAgent = new Agent({
  // Qdrant JS REST client uses 10 seconds:
  // https://github.com/qdrant/qdrant-js/blob/d3d385651fc43799aeba55bbd1b2c3d23f743ccb/packages/js-client-rest/src/dispatcher.ts#L21
  // but the socket error (other side closed) still happens with 10s, and after further digging qdrant's repo,
  // also found out a connection timeout of 2 seconds:
  // https://github.com/qdrant/qdrant/blob/48203e414e4e7f639a6d394fb6e4df695f808e51/lib/api/src/grpc/transport_channel_pool.rs#L25
  keepAliveTimeout: 2_000,
});

const QDRANT_HEADERS = {
  'Content-Type': 'application/json',
  ...(process.env['QDRANT_API_KEY'] ? { 'api-key': process.env['QDRANT_API_KEY'] } : {}),
};

const BENCHMARK_RUNS = 100;
const COLLECTION_NAME = 'staging-db';
const SEARCHABLE_GROUPS = ['main', 'main-hot', 'main-warm', 'main-cold'];

// test vector with 1024 elements
const QUERY = [15, 151, 98, 23, 184, 66, 225, 54, 116, 176, 9, 250, 85, 137, 30, 190, 120, 74, 233, 22, 157, 103, 49, 186, 68, 218, 12, 142, 95, 2, 239, 72, 169, 107, 32, 205, 56, 123, 181, 63, 227, 20, 132, 87, 252, 47, 168, 117, 40, 203, 17, 153, 100, 26, 184, 67, 229, 58, 114, 174, 6, 245, 81, 138, 34, 192, 126, 79, 237, 24, 156, 105, 53, 188, 71, 217, 10, 140, 93, 1, 238, 73, 171, 109, 33, 206, 57, 123, 180, 62, 222, 18, 131, 86, 251, 46, 167, 115, 39, 200, 16, 155, 102, 27, 183, 65, 224, 50, 113, 173, 5, 244, 80, 136, 31, 191, 121, 75, 236, 29, 159, 104, 52, 187, 69, 219, 13, 143, 96, 4, 243, 78, 172, 111, 35, 208, 59, 125, 182, 64, 228, 21, 133, 88, 253, 48, 170, 118, 41, 201, 15, 151, 98, 23, 184, 66, 225, 54, 116, 176, 9, 250, 85, 137, 30, 190, 120, 74, 233, 22, 157, 103, 49, 186, 68, 218, 12, 142, 95, 2, 239, 72, 169, 107, 32, 205, 56, 123, 181, 63, 227, 224, 7, 142, 99, 201, 48, 11, 251, 84, 166, 33, 198, 120, 61, 230, 17, 133, 215, 76, 189, 41, 10, 244, 155, 93, 178, 60, 222, 1, 118, 54, 211, 147, 88, 19, 237, 70, 163, 105, 30, 209, 13, 150, 97, 24, 182, 65, 227, 43, 111, 174, 5, 255, 80, 138, 36, 194, 125, 73, 233, 28, 159, 102, 49, 186, 68, 218, 15, 145, 91, 2, 240, 77, 170, 108, 32, 204, 51, 123, 181, 63, 225, 20, 131, 85, 250, 46, 167, 114, 38, 199, 12, 148, 95, 22, 185, 69, 231, 56, 117, 176, 8, 248, 82, 136, 31, 192, 128, 79, 238, 26, 161, 106, 53, 188, 72, 216, 10, 141, 98, 21, 243, 75, 173, 112, 35, 207, 57, 126, 190, 66, 229, 3, 134, 89, 253, 44, 165, 119, 40, 200, 16, 152, 100, 25, 184, 64, 221, 50, 110, 172, 6, 247, 83, 139, 37, 196, 124, 78, 235, 29, 158, 104, 52, 187, 71, 219, 14, 146, 92, 4, 242, 74, 169, 109, 34, 206, 55, 122, 180, 62, 226, 23, 132, 87, 252, 47, 168, 116, 39, 202, 18, 154, 103, 27, 183, 67, 228, 58, 115, 175, 9, 249, 86, 137, 32, 195, 127, 81, 239, 24, 160, 107, 54, 191, 73, 220, 13, 144, 96, 1, 241, 76, 171, 113, 36, 208, 59, 127, 189, 65, 224, 22, 130, 84, 249, 45, 166, 118, 41, 201, 15, 151, 100, 26, 183, 63, 220, 49, 112, 173, 5, 246, 81, 138, 35, 193, 124, 77, 234, 27, 157, 103, 51, 186, 70, 217, 12, 143, 97, 3, 241, 74, 168, 110, 33, 205, 54, 121, 179, 61, 223, 19, 132, 86, 251, 46, 167, 117, 40, 203, 17, 153, 101, 24, 182, 66, 226, 53, 114, 174, 8, 248, 85, 136, 30, 192, 126, 78, 237, 25, 159, 105, 52, 188, 72, 218, 11, 142, 99, 2, 240, 73, 170, 108, 32, 204, 56, 125, 181, 62, 227, 21, 131, 87, 252, 47, 169, 116, 39, 200, 16, 152, 98, 23, 184, 68, 229, 57, 113, 172, 7, 247, 83, 139, 36, 194, 123, 76, 235, 28, 158, 104, 50, 185, 69, 219, 14, 145, 91, 1, 239, 75, 171, 111, 34, 207, 58, 124, 180, 64, 228, 20, 130, 85, 250, 45, 165, 115, 38, 202, 18, 154, 102, 27, 183, 67, 230, 59, 117, 176, 10, 251, 86, 137, 31, 193, 122, 74, 233, 26, 157, 106, 53, 189, 71, 221, 13, 143, 96, 4, 242, 79, 173, 112, 35, 206, 55, 121, 178, 60, 224, 17, 129, 84, 248, 44, 164, 114, 37, 199, 15, 151, 97, 22, 182, 66, 226, 54, 118, 177, 9, 249, 82, 135, 30, 191, 125, 78, 236, 29, 160, 107, 51, 186, 70, 216, 12, 142, 95, 3, 241, 77, 172, 110, 33, 205, 52, 120, 179, 61, 223, 19, 133, 88, 253, 48, 170, 119, 41, 201, 14, 150, 99, 25, 187, 69, 225, 56, 116, 175, 8, 246, 80, 134, 28, 190, 124, 76, 234, 23, 158, 103, 49, 185, 68, 218, 11, 141, 94, 2, 240, 72, 169, 108, 32, 204, 55, 122, 181, 63, 227, 20, 132, 87, 252, 47, 168, 117, 40, 203, 17, 153, 100, 26, 184, 67, 229, 58, 114, 174, 6, 245, 81, 138, 34, 192, 126, 79, 237, 24, 156, 105, 53, 188, 71, 217, 10, 140, 93, 1, 238, 73, 171, 109, 33, 206, 57, 123, 180, 62, 222, 18, 131, 86, 251, 46, 167, 115, 39, 200, 16, 155, 102, 27, 183, 65, 224, 50, 113, 173, 5, 244, 80, 136, 31, 191, 121, 75, 236, 29, 159, 104, 52, 187, 69, 219, 13, 143, 96, 4, 243, 78, 172, 111, 35, 208, 59, 125, 182, 64, 228, 21, 133, 88, 253, 48, 170, 118, 41, 201, 15, 151, 98, 23, 184, 66, 225, 54, 116, 176, 9, 250, 85, 137, 30, 190, 120, 74, 233, 22, 157, 103, 49, 186, 68, 218, 12, 142, 95, 2, 239, 72, 169, 107, 32, 205, 56, 123, 181, 63, 227, 20, 132, 87, 252, 47, 168, 117, 40, 203, 17, 153, 100, 26, 184, 67, 229, 58, 114, 174, 6, 245, 81, 138, 34, 192, 126, 79, 237, 24, 156, 105, 53, 188, 71, 217, 10, 140, 93, 1, 238, 73, 171, 109, 33, 206, 57, 123, 180, 62, 222, 18, 131, 86, 251, 46, 167, 115, 39, 200, 16, 155, 102, 27, 183, 65, 224, 50, 113, 173, 5, 244, 80, 136, 31, 191, 121, 75, 236, 29, 159, 104, 52, 187, 69, 219, 13, 143, 96, 4, 243, 78, 172, 111, 35, 208, 59, 125, 182, 64, 228, 21, 133, 88, 253, 48, 170, 118, 41, 201, 15, 151, 98, 23, 184, 66, 225, 54, 116, 176, 9, 250, 85, 137, 30, 190, 120, 74, 233, 22, 157, 103, 49, 186, 68, 218, 12, 142, 95, 2, 239, 72, 169, 107, 32, 205, 56, 123, 181, 63, 227, 20];

const searches = SEARCHABLE_GROUPS.map((g) => {
  return {
    query: QUERY,
    limit: 10,
    filter: {
      must: [
        {
          // groupId is a multitenant payload index
          key: "groupId",
          match: {
            value: g
          }
        }
      ],
    },
    ['with_payload']: true,
    params: {
      ['hnsw_ef']: 64,
    },
  };
});

async function performSearch(searches) {
  const requestBody = JSON.stringify({ searches });

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 500);

  try {
    const data = await new Promise((resolve, reject) => {
      const bodyChunks = [];
      let statusCode;
      let contentEncoding = 'gzip';

      qdrantAgent.dispatch(
        {
          origin: 'http://localhost:6333',
          path: `/collections/${COLLECTION_NAME}/points/query/batch`,
          method: 'POST',
          headers: {
            ...QDRANT_HEADERS,
            'Content-Length': Buffer.byteLength(requestBody),
            'Accept-Encoding': 'gzip',
          },
          body: requestBody,
          signal: controller.signal,
        },
        {
          onConnect: (abort) => { },
          onHeaders: (status, headers, resume) => {
            statusCode = status;
            resume();
          },
          onData: (chunk) => {
            bodyChunks.push(chunk);
          },
          onComplete: (trailers) => {
            const responseBuffer = Buffer.concat(bodyChunks);

            const processBody = (buffer) => {
              const responseBody = buffer.toString('utf8');
              if (statusCode < 200 || statusCode >= 300) {
                reject(new Error(`Request failed with status ${statusCode}: ${responseBody}`));
              } else {
                try {
                  resolve(JSON.parse(responseBody));
                } catch (e) {
                  reject(new Error('Failed to parse JSON response: ' + e.message));
                }
              }
            };

            if (contentEncoding === 'gzip') {
              zlib.gunzip(responseBuffer, (err, decompressed) => {
                if (err) {
                  return reject(new Error('Failed to decompress gzipped response: ' + err.message));
                }
                processBody(decompressed);
              });
            } else {
              processBody(responseBuffer);
            }
          },
          onError: (err) => {
            reject(err);
          },
        }
      );
    });

    return data.result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 500ms');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

let total = 0;
for (let i = 0; i < BENCHMARK_RUNS; i++) {
  const start = performance.now();
  await performSearch(searches);
  total += (performance.now() - start);
}
console.log(`Fast REST (gzip) perf avg over ${BENCHMARK_RUNS} runs:`, (total / BENCHMARK_RUNS).toFixed(3), 'ms');

process.exit(0);

