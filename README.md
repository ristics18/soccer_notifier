# Indoor Soccer Notifier
This script parses through schedule tables on Indoor Soccer Website and it sends emails and SMS messages whenever there is a game coming up for a certain team

## Setup

config.json:
```yaml
{
    "twilio_account_sid": "", // your twilio account id (www.twilio.com)
    "twilio_auth_token": "", // your twilio auth token (www.twilio.com)
    "yahoo_email": "", // email address that is going to be used as a sender
    "yahoo_password": "", // password to email account that is going to be used as a sender
    "twilio_phone_number": "", // your twilio phone number (www.twilio.com)
    "send_emails": true, // flag that controlls whether the script should send emails or not
    "send_sms": true, // flag that controlls whether the script should send sms or not
    "is_production": true // are you running production code or just debugging
}
```

data.json:
```yaml
[
    // Your first team
    {
        "team_name": "", // team name
        "web_page_table_selector": "", // id table selector from the actual indoor soccer page (second table on the page, contains Schedule word)
        "web_page_url": "", // url to the actual page with teams and their schedule
        "email_recipients": "", // email recipients
        "phone_recipients": [], // phone recipients
        "notify_days_ahead": [0, 3] // notify days ahead (0 means game day - notify on game day)
    }
]
```