"""Keep this Mac's SSH connection on en0, outside the local TUN proxy."""
import os
import select
import socket
import sys

connection = socket.socket()
connection.setsockopt(socket.IPPROTO_IP, 25, socket.if_nametoindex('en0'))
connection.settimeout(15)
connection.connect((sys.argv[1], int(sys.argv[2])))
connection.settimeout(None)
while True:
    ready, _, _ = select.select([connection, sys.stdin.buffer], [], [])
    if connection in ready:
        data = connection.recv(65536)
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
    if sys.stdin.buffer in ready:
        data = os.read(0, 65536)
        if not data:
            break
        connection.sendall(data)
