#!/bin/bash
echo "Testing concurrent session creation..."

# Function to create a session
create_session() {
    local id=$1
    curl -s -X POST -H "Content-Type: application/json" \
         -d "{\"command\":\"sleep ${id}\",\"cols\":80,\"rows\":24}" \
         http://localhost:3002/api/sessions > /dev/null
    echo "Created session $id"
}

# Create 10 sessions concurrently
for i in {1..10}; do
    create_session $i &
done

wait
echo "All sessions created"
