export const currentUser = {
    id: "me",
    name: "You",
    email: "you@email.com",
    avatar: "Y",
    status: "Available",
    about: "Hey there! I am using ConnectHub",
    phone: "+1 234 567 8900",
    online: true,
    lastSeen: "Online",
};
const allContacts = [
    { id: "u1", name: "Sarah Chen", avatar: "SC", role: "member", online: true, joinedAt: "2024-01-15" },
    { id: "u2", name: "Alex Rivera", avatar: "AR", role: "member", online: true, joinedAt: "2024-01-15" },
    { id: "u3", name: "Maya Patel", avatar: "MP", role: "member", online: false, joinedAt: "2024-02-01" },
    { id: "u4", name: "James Wilson", avatar: "JW", role: "member", online: false, joinedAt: "2024-02-10" },
    { id: "u5", name: "Liam Brown", avatar: "LB", role: "member", online: true, joinedAt: "2024-03-01" },
    { id: "u6", name: "Emma Davis", avatar: "ED", role: "member", online: false, joinedAt: "2024-03-05" },
];
export const getContacts = () => allContacts;
export const mockChats = [
    {
        id: "1", name: "Sarah Chen", avatar: "SC", lastMessage: "That sounds amazing! 🎉", time: "2m",
        unread: 3, online: true, isGroup: false,
        messages: [
            { id: "1", text: "Hey! How's the project going?", sent: false, time: "10:30 AM", senderId: "u1", type: "text", status: "read" },
            { id: "2", text: "Going great! Just finished the UI", sent: true, time: "10:32 AM", senderId: "me", type: "text", status: "read" },
            { id: "3", text: "That sounds amazing! 🎉", sent: false, time: "10:33 AM", senderId: "u1", type: "text", status: "read" },
        ],
    },
    {
        id: "2", name: "Alex Rivera", avatar: "AR", lastMessage: "Let's catch up tomorrow", time: "15m",
        unread: 0, online: true, isGroup: false,
        messages: [
            { id: "1", text: "Are you free this week?", sent: false, time: "9:00 AM", senderId: "u2", type: "text", status: "read" },
            { id: "2", text: "Sure, how about Thursday?", sent: true, time: "9:15 AM", senderId: "me", type: "text", status: "delivered" },
            { id: "3", text: "Let's catch up tomorrow", sent: false, time: "9:20 AM", senderId: "u2", type: "text", status: "read" },
        ],
    },
    {
        id: "3", name: "Maya Patel", avatar: "MP", lastMessage: "Check this design out!", time: "1h",
        unread: 1, online: false, isGroup: false,
        messages: [
            { id: "1", text: "I've been working on something cool", sent: false, time: "8:00 AM", senderId: "u3", type: "text", status: "read" },
            { id: "2", text: "Show me!", sent: true, time: "8:05 AM", senderId: "me", type: "text", status: "read" },
            { id: "3", text: "Check this design out!", sent: false, time: "8:10 AM", senderId: "u3", type: "text", status: "read" },
        ],
    },
    {
        id: "4", name: "James Wilson", avatar: "JW", lastMessage: "Thanks for the help!", time: "3h",
        unread: 0, online: false, isGroup: false,
        messages: [
            { id: "1", text: "Can you review my PR?", sent: false, time: "6:00 AM", senderId: "u4", type: "text", status: "read" },
            { id: "2", text: "Sure, looks good to me ✅", sent: true, time: "6:30 AM", senderId: "me", type: "text", status: "read" },
            { id: "3", text: "Thanks for the help!", sent: false, time: "6:35 AM", senderId: "u4", type: "text", status: "read" },
        ],
    },
    {
        id: "5", name: "Team Design", avatar: "TD", lastMessage: "Meeting at 3pm", time: "5h",
        unread: 5, online: true, isGroup: true,
        description: "Design team collaboration group",
        createdBy: "me",
        members: [
            { id: "me", name: "You", avatar: "Y", role: "admin", online: true, joinedAt: "2024-01-01" },
            { id: "u1", name: "Sarah Chen", avatar: "SC", role: "admin", online: true, joinedAt: "2024-01-01" },
            { id: "u3", name: "Maya Patel", avatar: "MP", role: "member", online: false, joinedAt: "2024-01-15" },
            { id: "u4", name: "James Wilson", avatar: "JW", role: "member", online: false, joinedAt: "2024-02-01" },
        ],
        messages: [
            { id: "1", text: "New sprint starts Monday", sent: false, time: "Yesterday", senderId: "u1", senderName: "Sarah", type: "text", status: "read" },
            { id: "2", text: "Got it, I'll prepare the tickets", sent: true, time: "Yesterday", senderId: "me", type: "text", status: "read" },
            { id: "3", text: "Meeting at 3pm", sent: false, time: "Today", senderId: "u3", senderName: "Maya", type: "text", status: "read" },
        ],
    },
    {
        id: "6", name: "Dev Squad", avatar: "DS", lastMessage: "Deployed v2.0 🚀", time: "1d",
        unread: 0, online: true, isGroup: true,
        description: "Development team chat",
        createdBy: "u2",
        members: [
            { id: "u2", name: "Alex Rivera", avatar: "AR", role: "admin", online: true, joinedAt: "2024-01-01" },
            { id: "me", name: "You", avatar: "Y", role: "member", online: true, joinedAt: "2024-01-01" },
            { id: "u5", name: "Liam Brown", avatar: "LB", role: "member", online: true, joinedAt: "2024-02-01" },
            { id: "u6", name: "Emma Davis", avatar: "ED", role: "member", online: false, joinedAt: "2024-03-01" },
        ],
        messages: [
            { id: "1", text: "CI/CD pipeline is ready", sent: false, time: "Yesterday", senderId: "u2", senderName: "Alex", type: "text", status: "read" },
            { id: "2", text: "Deployed v2.0 🚀", sent: false, time: "Yesterday", senderId: "u5", senderName: "Liam", type: "text", status: "read" },
        ],
    },
];
