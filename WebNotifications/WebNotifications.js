
var notificationCount = 1;

function requestPermission() {
    if (window.Notification && Notification.permission !== "granted") {
        Notification.requestPermission(function (status) {
            if (Notification.permission !== status) {
                Notification.permission = status;
            }
        });
    }
}

function showNotification() {
    var notification = new Notification("Test Notification: " + notificationCount++);
}

function showBulkNotifications() {
    setInterval(function() {
        var notification = new Notification("Test Notification: " + notificationCount);
        document.title = "Sent #" + notificationCount;
        notificationCount++;
    }, 1000);
}

function delayedNotifications() {
    setInterval(function() {
        var notification = new Notification("Test Notification: " + notificationCount);
        document.title = "Sent #" + notificationCount;
        notificationCount++;
    }, 10000);
}

function logTime() {
    var currentdate = new Date(); 
    var time = ""
                + currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds();
 
    var ta = document.getElementById("ta");
    ta.value += "Time: " + time + "\r\n";
    document.title = "Time: " + time;
}
