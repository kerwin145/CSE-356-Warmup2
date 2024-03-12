document.getElementById('login').addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('logoutSection').style.display = 'block';
        } else {
            console.log("login failed");
        }
    })
    .catch(error => console.error('Error:', error));
});

document.getElementById('logout').addEventListener('click', function() {
    fetch('/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(() => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('logoutSection').style.display = 'none';
    })
    .catch(error => console.error('Error:', error));
});