Chat Connection Manager 

Creates and manages multiple desktop-chat-service instances so the UI can have more than opne active prompt occuring at the same time, either in the same thread such as in branches, or in different threads. 

this new class will have 4 end points:

init() - initializes internal data and status
close() - closes all chat services and updates status
status - returns the number of chat services with time since last access and number of chat calls
get(app slug, provider, model) - create or return a desktop chat service if one has been created for this tuple

The connection manager will support up to MAXIMUM_POOL_SIZE services, which is either 0 for unlimited or a number. 

The electron app will call init on startup.
The elctron app will call close on shutdown and exit. 
The ipc-handler for chat will call the get method instead of directly instantiating a desktop-chat-service instance. 

Once the connection manager returns a chat service, the caller can use the chat method just like before. 


