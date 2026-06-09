import { Server } from 'socket.io';

let io: Server;

export const initSocket = (httpServer: Parameters<typeof Server>[0]) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });
  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
