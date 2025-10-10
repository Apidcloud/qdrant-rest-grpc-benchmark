# Query
We are doing 4 search requests in a batch, with the filter being a payload index (multi tenancy):
```json
"payload_schema": {
    "groupId": {
        "data_type": "keyword",
        "params": {
            "type": "keyword", 
            "is_tenant": true
        },
        "points": 786
    }
}
```

Specifically, we get 10 results from each of the searches within the batch, meaning a total of 40 results. The performance benchmark shows, however, that the gRPC counterpart (with Qdrant's official clients or through Postman) is a lot slower when dealing with payloads, particularly with big strings inside.

# Setup

- Unzip the Qdrant db snapshot and load it (should contain between 750 and 900 points) 
- Install nodejs 22.20
- Run ```npm ci``` to install dependencies
- Run ```npm test``` to run the fast rest, rest, and grpc benchmarks __with__ payloads

# Results
This was measured on a dual-core ubuntu 22.14 machine. For reference, running it on a Qdrant cluster with 1 shard and 3 nodes, with each node having 8 vCPUs, yields similar results.

Running this benchmark with node 22.20.0 yields the following results (with full payloads):
- Fast REST perf avg over 100 runs: 13.314ms
- Fast REST (gzip) perf avg over 100 runs: 50.031ms
- REST perf avg over 100 runs: 59.447 ms
- gRPC perf avg over 100 runs: 226.307 ms

If we run it without payloads we can see that gRPC is a lot faster than the REST with axios counterpart:
- Fast REST perf avg over 100 runs: 1.476ms (without gzip, unlike the other 2 approaches)
- Fast REST (gzip) perf avg over 100 runs: 38.402 ms
- REST perf avg over 100 runs: 40.699 ms
- gRPC perf avg over 100 runs: 4.908 ms

```grpc.js```, ```rest.js```, and ```rest-fast-gzip.js``` use gzip compression, whereas ```rest-fast.js``` doesn't. I couldn't try the gRPC without gzip compression yet, but somone on discord did say it gets down to 50ms in their setup (also, for reference, in their setup the full payload REST perf avg is 37.721ms vs my 59.447ms).
