/* eslint-disable eqeqeq */
module.exports = (inputDate, type) => {
  let formatedDate = '';
  let formatedMonth = '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (inputDate) {
    // console.log(inputDate)
    const year = inputDate.getFullYear();
    const month = inputDate.getMonth();
    const day = inputDate.getDate();

    // const seconds = inputDate.getSeconds();
    const minutes = inputDate.getMinutes();
    const hour = inputDate.getHours();
    const ampm = (hour >= 12) ? 'PM' : 'AM';

    // for (index in month){
    // }
    months.forEach((_month) => {
      if (month == _month) {
        formatedMonth = months[month];
      }
    });

    // for (const index in months) {
    //   if (index == month) {
    //     formatedMonth = months[month];
    //   }
    // }

    if (type == 1) {
      formatedDate = `${(inputDate.getDate() < 10) ? (`0${inputDate.getDate()}`) : inputDate.getDate()} ${formatedMonth} ${year}`;
    }
    if (type == 2) {
      formatedDate = `${year}/${(month < 9) ? (`0${month + 1}`) : (month + 1)}/${(day < 10) ? (`0${day}`) : day}`;
    }
    if (type == 3) {
      formatedDate = `${formatedMonth} ${inputDate.getDate()}`;
    }
    if (type == 4) {
      formatedDate = `${(hour < 10) ? (`0${hour}`) : hour}:${(minutes < 10) ? (`0${minutes}`) : minutes} ${ampm}`;
    }
    if (type == 5) {
      formatedDate = `${(inputDate.getDate() < 10) ? (`0${inputDate.getDate()}`) : inputDate.getDate()} ${formatedMonth}, ${year}`;
    }
    if (type == 6) {
      formatedDate = `${(month < 9) ? (`0${month + 1}`) : (month + 1)}-${(day < 10) ? (`0${day}`) : day}-${year}`;
    }
  }
  // console.log(formatedDate)
  return formatedDate.toString();
};
