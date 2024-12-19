const getModifiedItems = (items, categories) => {
  const itemsWithImages = items.map((item) => {
    const categoryDetail = categories.find((cat) =>
      cat._id.equals(item.category)
    );

    return {
      ...item.toObject(),
      category: categoryDetail,
      image: {
        contentType: item.image.contentType,
        data: {
          type: "Buffer",
          data: Array.from(item.image.data),
        },
      },
    };
  });

  return itemsWithImages;
};


const removeExpiredPoints = (user) => {
  const now = new Date();
  
  const validPointsHistory = user.pointsHistory.filter(
    (entry) => entry.expiresOn > now
  );

 
  user.point = validPointsHistory.reduce(
    (total, entry) => total + entry.points,
    0
  );

  
  user.pointsHistory = validPointsHistory;
};


const  deductPointsFromArray = (arr, pointsToDeduct) => {
  for (let i = 0; i < arr.length && pointsToDeduct > 0; i++) {
    if (arr[i].point <= pointsToDeduct) {
      pointsToDeduct -= arr[i].point; 
      arr[i].point = 0; 
    } else {
      arr[i].point -= pointsToDeduct;
      pointsToDeduct = 0;
    }
  }
  
  
  const modifiedArray = arr.filter(item => item.point > 0);
  return modifiedArray;
}

module.exports = { getModifiedItems, removeExpiredPoints, deductPointsFromArray };
