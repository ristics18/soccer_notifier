/*
    Author:         Srdan Ristic
    Date:           08/01/2021
    Description:    Indoor Soccer Notifier
*/

// SETTINGS
const email_list = '' // send emails to
const phones_list = [''] // my phone number
const twilio_account_sid = ''; // twilio account sid
const twilio_auth_token = ''; // twilio auth token
const twilio_phone_number = '' // twilio phone number 
const yahoo_email = ''; // my yahoo email (send)
const yahoo_password = ''; // my yahoo password
const team_name = "Broadmoor Blues (Blue)"
const is_production = true; // are you debugging?

// LIBRARIES
const cheerio = require('cheerio');
const got = require('got');
const nodemailer = require('nodemailer');
const client = require('twilio')(twilio_account_sid, twilio_auth_token);

// OTHER
const table_selector = '#ctl00_C_Schedule1_GridView1'
const url = 'https://shreveportindoorsoccer.ezleagues.ezfacility.com/leagues/396763/Mens-3.aspx';
const notify_me_days_ahead = [0, 3];
const months =
[
    {month: 'Jan', monthNum: '1'},
    {month: 'Feb', monthNum: '2'},
    {month: 'Mar', monthNum: '3'},
    {month: 'Apr', monthNum: '4'},
    {month: 'May', monthNum: '5'},
    {month: 'Jun', monthNum: '6'},
    {month: 'Jul', monthNum: '7'},
    {month: 'Aug', monthNum: '8'},
    {month: 'Sep', monthNum: '9'},
    {month: 'Oct', monthNum: '10'},
    {month: 'Nov', monthNum: '11'},
    {month: 'Dec', monthNum: '12'}
]

function Run(){
    return new Promise((resolve, reject) => {
    got(url).then(response => {
        const $ = cheerio.load(response.body);
        const options = {
            rowForHeadings: 0,  // extract th cells from this row for column headings (zero-based)
            ignoreHeadingRow: true, // Don't tread the heading row as data
            ignoreRows: [],
        }
        const jsonReponse = []
        const columnHeadings = []
        const my_team = []
        const unplayed_games = []

        function get_col_headings(headingRow) {
            const alreadySeen = {}

            $(headingRow).find('th').each(function(j, cell) {
                let tr = $(cell).text().trim()

                if ( alreadySeen[tr] ) {
                    let suffix = ++alreadySeen[tr]
                    tr = `${tr}_${suffix}`
                } else {
                    alreadySeen[tr] = 1
                }

                if (tr === '') {
                    tr = 'Score'
                }

                if (tr === 'Time/Status') {
                    tr = 'TimeStatus'
                }

                columnHeadings.push(tr)
            })
        }

        function process_row(i, row) {
            const rowJson = {}

            if ( options.ignoreHeadingRow && i === options.rowForHeadings ) return
            // TODO: Process options.ignoreRows

            $(row).find('td').each(function(j, cell) {
                rowJson[ columnHeadings[j] ] = $(cell).text().trim()
            })

            // Skip blank rows
            if (JSON.stringify(rowJson) !== '{}') jsonReponse.push(rowJson)
        }

        $(table_selector).each(function(i, table) {
            var trs = $(table).find('tr')

            // Set up the column heading names
            get_col_headings( $(trs[options.rowForHeadings]) )

            // Process rows for data
            $(table).find('tr').each(process_row)

            process_my_team();
        })

        function notify(body) {
            var transporter = nodemailer.createTransport({
                host: 'smtp.mail.yahoo.com',
                port: 465,
                service: 'Yahoo',
                secure: false,
                auth: {
                    user: yahoo_email,
                    pass: yahoo_password
                }
                // logger: 'true'
            });
            
            var mailOptions = {
                from: yahoo_email,
                to: email_list, // recipients
                subject: 'Shreveport Indoor Soccer Notification',
                text: body
            };
        
            var promises = [];

            // Send Email
            var email_promise =  new Promise((resolve, reject) => {
                 transporter.sendMail(mailOptions, function(error, info)
                {
                    if (error) {
                        reject(error);
                    } else {
                        resolve('Emails sent: ' + info.response);
                    }
                })
            });
            promises.push(email_promise);

            // Send SMS Messages
            phones_list.forEach(phone_number  => {
                var sms_promise = new Promise((resolve, reject) => {
                    client.messages.create({
                        body: body,
                        from: twilio_phone_number,
                        to: phone_number
                    })
                    .then(message => {
                        resolve(message)
                    })
                    .catch(err => {
                        reject(err)
                    });
                });
                promises.push(sms_promise);
            });

            return promises;
        }

        function get_date(addDays) {
            var datetime = new Date();
            if (addDays !== '' && addDays !== undefined) {
                datetime.setDate(datetime.getDate() + addDays);
            }

            var month = datetime.getMonth() + 1; //months from 1-12
            var day = datetime.getDate();
            var year = datetime.getFullYear();
            return year + "/" + month + "/" + day;
        }
        
        function parse_date(date) {
            var datetime = new Date();
            var year = datetime.getUTCFullYear();
            var justMonth = date.substring(
                date.lastIndexOf("-") + 1,
                date.lastIndexOf(" ")
            );
            var justDay = date.substring(
                date.lastIndexOf(" ") + 1,
                date.length
            );
        
            var result = year + '/';
            $(months).each(function(i, element) {
                if (element.month === justMonth) {
                    result += element.monthNum + '/';
                }
            })
            result += justDay
            return result;
        }
        
        function find_game(games, findDate) {
            var result = null;
            games.forEach(game  => {
                if (game.FormattedDate === findDate) 
                {
                    result = game;
                    return;
                }
            });
            return result;
        }
        
        function process_my_team() {
            $(jsonReponse).each(function(i, element) {
                var home = element.Home;
                var away = element.Away;
                if (home === team_name || away === team_name) 
                {
                    my_team.push(element)
                }
            })
        
            $(my_team).each(function(i, element) {
                if (element.Score === 'v' && element.TimeStatus !== 'Complete' && element.Officials === '' ) {
                    unplayed_games.push(element);
                }
            })

            unplayed_games.forEach(unplayed_game  => {
                unplayed_game.FormattedDate = parse_date(unplayed_game.Date);
            });
        
            var game_coming_up = null;
            notify_me_days_ahead.forEach(notifyDays  => {
                var date_to_check = get_date(notifyDays)
                var game = find_game(unplayed_games, date_to_check);
                if (game !== null) {
                    game_coming_up = game;
                    return;
                } 
            });

            var message = '';
            if (game_coming_up !== null)
            {
                message += 'YOU HAVE A GAME COMING UP!' + '\n'
                message += 'Game Date: ' + game_coming_up.Date + '\n'
                message += 'Teams: ' + game_coming_up.Home + ' vs ' + game_coming_up.Away + '\n'
                message += 'Time: ' + game_coming_up.TimeStatus + '\n'
                message += '------------------------------' + '\n'
            }
        
            if (message !== null && message !== undefined && message !== '') 
            {
                var promises = notify(message);
                Promise.all(promises).then((values) => {
                    resolve(values)
                });
            }
            else
            {
                resolve("No games!")
            }
        }
        }).catch(err => {
            reject(err)
        });
    });
}

// DEBUG
if (!is_production)
{
    var run = async function(event) {
        try 
        {
            return await Run();
        }
        catch (exception) 
        {
            return { message: "Something went wrong" }
        }
    };
    run()
}
// LAMBDA
else
{
    exports.handler = async function(event) {
        try 
        {
            return await Run();
        }
        catch (exception) 
        {
            return { message: "Something went wrong" }
        }
    };
}
